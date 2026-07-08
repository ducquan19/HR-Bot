import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobDescription, PositionSkill, Skill, Recommendation } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

export interface ParsedCv {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  education: string[];
  skills: string[];
  experienceYears: number;
  projects: string[];
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

  async parseCv(rawText: string): Promise<ParsedCv> {
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
      projects: this.extractProjects(normalized),
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

  async embed(text: string): Promise<number[]> {
    const dim = 1536;
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
