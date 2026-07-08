import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobDescription, PositionSkill, Skill, Recommendation } from '@prisma/client';
import { z } from 'zod';

const parsedCvSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  education: z.array(z.string()),
  skills: z.array(z.string()),
  experienceYears: z.number().min(0),
  experiences: z.array(z.object({
    company: z.string().optional(),
    title: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    description: z.string().optional(),
    years: z.number().min(0).optional(),
  })),
  projects: z.array(z.string()),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  summary: z.string(),
});

const parsedCvJsonSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', description: 'Candidate given name if available.' },
    lastName: { type: 'string', description: 'Candidate family name or remaining full name if available.' },
    email: { type: 'string', description: 'Candidate email address if available.' },
    phone: { type: 'string', description: 'Candidate phone number if available.' },
    education: { type: 'array', items: { type: 'string' }, description: 'Education entries as concise strings.' },
    skills: { type: 'array', items: { type: 'string' }, description: 'Technical and professional skills, normalized and deduplicated.' },
    experienceYears: { type: 'number', description: 'Estimated total years of relevant work experience.' },
    experiences: {
      type: 'array',
      description: 'Work experience entries extracted from the CV.',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          title: { type: 'string' },
          startDate: { type: 'string', description: 'Original or ISO-like start date if available.' },
          endDate: { type: 'string', description: 'Original or ISO-like end date if available.' },
          description: { type: 'string' },
          years: { type: 'number' },
        },
      },
    },
    projects: { type: 'array', items: { type: 'string' }, description: 'Projects as concise descriptions.' },
    certifications: { type: 'array', items: { type: 'string' }, description: 'Certificates and credentials.' },
    languages: { type: 'array', items: { type: 'string' }, description: 'Human languages and proficiency if available.' },
    summary: { type: 'string', description: 'Short recruiter-friendly profile summary.' },
  },
  required: ['education', 'skills', 'experienceYears', 'experiences', 'projects', 'certifications', 'languages', 'summary'],
} as const;

export interface ParsedCv {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  education: string[];
  skills: string[];
  experienceYears: number;
  experiences: Array<{
    company?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    years?: number;
  }>;
  projects: string[];
  certifications: string[];
  languages: string[];
  summary: string;
}

export interface ScreeningInput {
  parsedCv: ParsedCv;
  jd?: JobDescription | null;
  positionSkills?: Array<PositionSkill & { skill: Skill }>;
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    const provider = this.config.get<string>('ai.provider', 'mock');
    const geminiApiKey = this.config.get<string>('ai.geminiApiKey');

    if (nodeEnv === 'production' && (provider !== 'gemini' || !geminiApiKey)) {
      throw new Error('Production requires AI_PROVIDER=gemini and GEMINI_API_KEY for real CV extraction');
    }

    if (provider !== 'gemini') {
      this.logger.warn('AI_PROVIDER is not gemini; CV extraction is using the local mock parser');
    }
  }

  getCvParserModelName() {
    return this.config.get<string>('ai.provider') === 'gemini'
      ? this.config.get<string>('ai.geminiModel', 'gemini-3.1-flash-lite')
      : 'mock-parser';
  }

  async parseCv(rawText: string): Promise<ParsedCv> {
    if (this.config.get<string>('ai.provider') === 'gemini') {
      return this.parseCvWithGemini(rawText);
    }
    return this.parseCvWithMock(rawText);
  }

  private async parseCvWithGemini(rawText: string): Promise<ParsedCv> {
    const apiKey = this.config.get<string>('ai.geminiApiKey');
    if (!apiKey) throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');

    const endpoint = this.config.get<string>('ai.geminiEndpoint', 'https://generativelanguage.googleapis.com/v1beta');
    const model = this.config.get<string>('ai.geminiModel', 'gemini-3.1-flash-lite');
    const response = await fetch(`${endpoint}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: this.buildCvExtractionPrompt(rawText) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: parsedCvJsonSchema,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini CV extraction failed with ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join('\n');
    if (!text) throw new Error('Gemini CV extraction returned no text content');

    const parsedJson = JSON.parse(text);
    return parsedCvSchema.parse(parsedJson);
  }

  private buildCvExtractionPrompt(rawText: string) {
    const normalized = rawText.replace(/\s+/g, ' ').trim().slice(0, 60000);
    return [
      'You are an HR CV extraction engine.',
      'Extract structured candidate information from the CV text.',
      'Return only JSON matching the provided schema.',
      'Use empty arrays for missing list fields. Use 0 for unknown experienceYears.',
      'Normalize skill names and remove duplicates. Do not invent facts not present in the CV.',
      '',
      'CV text:',
      normalized,
    ].join('\n');
  }

  private async parseCvWithMock(rawText: string): Promise<ParsedCv> {
    const normalized = rawText.replace(/\s+/g, ' ').trim();
    const email = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    const phone = normalized.match(/(\+?\d[\d\s.-]{8,}\d)/)?.[0];
    const knownSkills = ['JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'NestJS', 'Express', 'PostgreSQL', 'MongoDB', 'Docker', 'Kubernetes', 'AWS', 'Redis', 'Kafka', 'Python', 'Java', 'Go', 'SQL'];
    const skills = knownSkills.filter((s) => new RegExp(s.replace('.', '\\.'), 'i').test(normalized));
    const years = this.extractExperienceYears(normalized);
    return {
      email,
      phone,
      education: this.extractEducation(normalized),
      skills,
      experienceYears: years,
      experiences: [],
      projects: this.extractProjects(normalized),
      certifications: [],
      languages: [],
      summary: normalized.slice(0, 700),
    };
  }

  async screenCandidate(input: ScreeningInput) {
    const requiredSkills = input.positionSkills?.map((ps) => ps.skill.name) ?? [];
    const candidateSkills = input.parsedCv.skills.map((s) => s.toLowerCase());
    const matched = requiredSkills.filter((s) => candidateSkills.some((cs) => cs.includes(s.toLowerCase()) || s.toLowerCase().includes(cs)));
    const missing = requiredSkills.filter((s) => !matched.includes(s));
    const skillScore = requiredSkills.length ? (matched.length / requiredSkills.length) * 100 : 70;
    const requiredYears = input.jd?.experienceRequired ?? 2;
    const experienceScore = Math.min(100, (input.parsedCv.experienceYears / Math.max(requiredYears, 1)) * 100);
    const educationScore = input.parsedCv.education.length ? 80 : 50;
    const overallScore = Math.round(skillScore * 0.5 + experienceScore * 0.3 + educationScore * 0.2);
    const recommendation: Recommendation = overallScore >= 85 ? Recommendation.STRONG_RECOMMEND : overallScore >= 70 ? Recommendation.RECOMMEND : overallScore >= 55 ? Recommendation.CONSIDER : Recommendation.REJECT;

    return {
      overallScore,
      skillScore: Math.round(skillScore),
      educationScore,
      experienceScore: Math.round(experienceScore),
      recommendation,
      strengths: matched.length ? [`Matched skills: ${matched.join(', ')}`] : ['Has a readable CV profile'],
      weaknesses: missing.length ? [`Missing skills: ${missing.join(', ')}`] : [],
      missingSkills: missing,
      explanation: `Score is computed from skill match, experience and education. Replace this mock provider with OpenAI/Gemini for production screening.`,
    };
  }

  async generateInterviewQuestions(input: ScreeningInput) {
    const missing = input.positionSkills?.map((ps) => ps.skill.name).filter((s) => !input.parsedCv.skills.includes(s)) ?? [];
    const technical = (missing.length ? missing : input.parsedCv.skills.slice(0, 3)).map((skill, index) => ({
      order: index + 1,
      category: 'technical',
      question: `Describe a real project where you used or would apply ${skill}. What trade-offs did you consider?`,
    }));
    return [
      ...technical,
      { order: technical.length + 1, category: 'behavioral', question: 'Tell us about a difficult technical problem you solved and how you communicated it to stakeholders.' },
      { order: technical.length + 2, category: 'role-fit', question: 'Which requirement in this job description is your strongest fit, and which one needs more learning?' },
    ];
  }

  async embed(text: string, purpose: 'query' | 'document' = 'query'): Promise<number[]> {
    if (this.config.get<string>('ai.provider') === 'gemini') {
      return this.embedWithGemini(text, purpose);
    }
    return this.embedWithMock(text);
  }

  private async embedWithGemini(text: string, purpose: 'query' | 'document') {
    const apiKey = this.config.get<string>('ai.geminiApiKey');
    if (!apiKey) throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini');

    const endpoint = this.config.get<string>('ai.geminiEndpoint', 'https://generativelanguage.googleapis.com/v1beta');
    const model = this.config.get<string>('ai.geminiEmbeddingModel', 'gemini-embedding-2');
    const dimensions = this.config.get<number>('ai.embeddingDimension', 1536);
    const response = await fetch(`${endpoint}/models/${encodeURIComponent(model)}:embedContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        content: { parts: [{ text: this.formatEmbeddingText(text, purpose) }] },
        output_dimensionality: dimensions,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini embedding failed with ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const payload = await response.json() as any;
    const values = payload?.embedding?.values ?? payload?.embeddings?.[0]?.values;
    if (!Array.isArray(values) || values.length !== dimensions) {
      throw new Error(`Gemini embedding returned invalid vector length: ${Array.isArray(values) ? values.length : 'none'}`);
    }
    return values.map((value: unknown) => Number(value));
  }

  private formatEmbeddingText(text: string, purpose: 'query' | 'document') {
    const normalized = text.replace(/\s+/g, ' ').trim().slice(0, 30000);
    if (purpose === 'document') return `title: Candidate CV profile | text: ${normalized}`;
    return `task: search result | query: ${normalized}`;
  }

  private async embedWithMock(text: string): Promise<number[]> {
    const dim = this.config.get<number>('ai.embeddingDimension', 1536);
    const vector = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) vector[i % dim] += text.charCodeAt(i) / 255;
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }

  private extractExperienceYears(text: string): number {
    const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:\+\s*)?(years?|yrs?|năm)/gi)].map((m) => Number(m[1]));
    return matches.length ? Math.max(...matches) : 0;
  }

  private extractEducation(text: string): string[] {
    const edu = [];
    if (/bachelor|cử nhân|đại học/i.test(text)) edu.push('Bachelor');
    if (/master|thạc sĩ/i.test(text)) edu.push('Master');
    if (/phd|doctor|tiến sĩ/i.test(text)) edu.push('PhD');
    return edu;
  }

  private extractProjects(text: string): string[] {
    const projectSection = text.match(/projects?[:\s](.{0,500})/i)?.[1];
    return projectSection ? [projectSection.slice(0, 300)] : [];
  }
}
