import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobDescription, PositionSkill, Skill, Recommendation } from '@prisma/client';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

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

const scoreSchema = z.coerce.number().transform((value) => Math.max(0, Math.min(100, Math.round(value))));

const screeningResultSchema = z.object({
  overallScore: scoreSchema,
  skillScore: scoreSchema,
  educationScore: scoreSchema,
  experienceScore: scoreSchema,
  recommendation: z.preprocess(
    (value) => String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
    z.nativeEnum(Recommendation),
  ),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  explanation: z.string().optional(),
});

const screeningResultJsonSchema = {
  type: 'object',
  properties: {
    overallScore: { type: 'number', description: 'Overall matching score from 0 to 100.' },
    skillScore: { type: 'number', description: 'Skill matching score from 0 to 100.' },
    educationScore: { type: 'number', description: 'Education fit score from 0 to 100.' },
    experienceScore: { type: 'number', description: 'Experience fit score from 0 to 100.' },
    recommendation: {
      type: 'string',
      enum: ['STRONG_RECOMMEND', 'RECOMMEND', 'CONSIDER', 'REJECT'],
      description: 'Hiring recommendation enum.',
    },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Evidence-based strengths from the CV against the JD.' },
    weaknesses: { type: 'array', items: { type: 'string' }, description: 'Evidence-based limitations or concerns.' },
    missingSkills: { type: 'array', items: { type: 'string' }, description: 'Required or important skills not found in the CV.' },
    explanation: { type: 'string', description: 'Concise, transparent explanation of the score and recommendation.' },
  },
  required: ['overallScore', 'skillScore', 'educationScore', 'experienceScore', 'recommendation', 'strengths', 'weaknesses', 'missingSkills', 'explanation'],
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
export class AiService {
  private genai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genai = new GoogleGenAI({ apiKey });
    }
  }

export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    const provider = this.config.get<string>('ai.provider', 'mock');
    const geminiApiKey = this.config.get<string>('ai.geminiApiKey');

    if (nodeEnv === 'production' && (provider !== 'gemini' || !geminiApiKey)) {
      throw new Error('Production requires AI_PROVIDER=gemini and GEMINI_API_KEY for real AI extraction and screening');
    }

    if (provider !== 'gemini') {
      this.logger.warn('AI_PROVIDER is not gemini; CV extraction, screening and embeddings are using local mock providers');
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
    if (this.config.get<string>('ai.provider') === 'gemini') {
      return this.screenCandidateWithGemini(input);
    }
    return this.screenCandidateWithMock(input);
  }

  private async screenCandidateWithGemini(input: ScreeningInput) {
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
        contents: [{ role: 'user', parts: [{ text: this.buildScreeningPrompt(input) }] }],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',
          responseSchema: screeningResultJsonSchema,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini candidate screening failed with ${response.status}: ${errorText.slice(0, 500)}`);
    }

    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).filter(Boolean).join('\n');
    if (!text) throw new Error('Gemini candidate screening returned no text content');

    const parsedJson = JSON.parse(text);
    return screeningResultSchema.parse(parsedJson);
  }

  private buildScreeningPrompt(input: ScreeningInput) {
    return [
      'You are an HR candidate screening engine.',
      'Compare the extracted CV data with the job description and position skill requirements.',
      'Return only JSON matching the provided schema. Do not include markdown.',
      'Use only evidence present in the extracted CV and JD. Do not invent candidate facts.',
      'Scores must be percentages from 0 to 100.',
      'Recommendation must be one of STRONG_RECOMMEND, RECOMMEND, CONSIDER, REJECT.',
      '',
      'Scoring guidance:',
      '- skillScore: coverage, relevance, required level, and evidence for required/preferred skills.',
      '- experienceScore: years and relevance of experience compared with the JD.',
      '- educationScore: education fit compared with the JD, without over-penalizing if not required.',
      '- overallScore: balanced fit for the role, prioritizing skills and relevant experience.',
      '',
      'Extracted CV JSON:',
      JSON.stringify(input.parsedCv).slice(0, 30000),
      '',
      'Job description JSON:',
      JSON.stringify(input.jd ?? {}).slice(0, 12000),
      '',
      'Position skills JSON:',
      JSON.stringify((input.positionSkills ?? []).map((positionSkill) => ({
        name: positionSkill.skill.name,
        aliases: positionSkill.skill.aliases,
        requiredLevel: positionSkill.requiredLevel,
        minimumLevel: positionSkill.minimumLevel,
        weight: positionSkill.weight,
        isRequired: positionSkill.isRequired,
        notes: positionSkill.notes,
      }))).slice(0, 12000),
    ].join('\n');
  }

  private async screenCandidateWithMock(input: ScreeningInput) {
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
    
    if (this.genai) {
      try {
        const prompt = `You are an expert technical interviewer. Generate 3 to 5 virtual interview questions based on the candidate's CV and the job description.
        
        Job Description:
        ${JSON.stringify(input.jd)}
        
        Required Skills:
        ${input.positionSkills?.map((ps) => ps.skill.name).join(', ')}
        
        Candidate CV Summary:
        ${input.parsedCv.summary}
        
        Candidate Skills:
        ${input.parsedCv.skills.join(', ')}
        
        Missing Skills (skills required but not in CV):
        ${missing.join(', ')}
        
        Generate a mix of technical, behavioral, and role-fit questions. If there are missing skills, prioritize asking about how they would approach learning or working with those missing skills.
        
        Return the result as a JSON array of objects. Each object MUST have:
        - "category": string (e.g., "technical", "behavioral", "role-fit")
        - "question": string (the interview question)
        
        Do NOT wrap the JSON array in any markdown formatting like \`\`\`json. Return only the raw JSON array string.`;
        
        const response = await this.genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        
        const generated = JSON.parse(response.text || '[]') as Array<{ category: string; question: string }>;
        return generated.map((q, index) => ({
          order: index + 1,
          category: q.category,
          question: q.question,
        }));
      } catch (error) {
        console.error('Gemini question generation failed:', error);
        throw new Error('AI API Quota exceeded or unavailable. Cannot generate interview questions at this time.');
      }
    }
    
    // Throw error if Gemini is not configured
    throw new Error('AI API is not configured. Cannot generate interview questions.');
  }

  async evaluateInterview(questions: any[]): Promise<{ score: number; feedback: string }> {
    const answeredQuestions = questions.filter(q => q.answer && q.answer.answer);
    if (answeredQuestions.length === 0) {
      return { score: 0, feedback: 'Candidate did not answer any questions.' };
    }

    if (this.genai) {
      try {
        const prompt = `You are an expert technical interviewer evaluating a candidate's virtual interview.
        
        Here are the questions and the candidate's answers:
        ${JSON.stringify(answeredQuestions.map(q => ({ question: q.question, category: q.category, answer: q.answer.answer })))}
        
        Evaluate the answers based on technical accuracy, clarity, and problem-solving approach.
        Provide a score from 0 to 100, and a concise overall feedback paragraph explaining the score and highlighting strengths and areas for improvement.
        
        Return the result as a JSON object. The object MUST have:
        - "score": number (0-100)
        - "feedback": string
        
        Do NOT wrap the JSON in any markdown formatting like \`\`\`json. Return only the raw JSON object string.`;
        
        const response = await this.genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        
        const result = JSON.parse(response.text || '{}');
        return {
          score: Math.round(result.score || 0),
          feedback: result.feedback || 'No feedback provided.',
        };
      } catch (error) {
        console.error('Gemini interview evaluation failed:', error);
        return {
          score: 0,
          feedback: 'Hệ thống AI đang quá tải hoặc không khả dụng. Vui lòng thử lại sau hoặc để HR đánh giá thủ công.',
        };
      }
    }

    return {
      score: 0,
      feedback: 'AI Provider is not configured. Cannot evaluate interview.',
    };
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
