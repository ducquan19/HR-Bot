import { Injectable } from '@nestjs/common';
import { JobDescription, PositionSkill, Skill, Recommendation } from '@prisma/client';

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
