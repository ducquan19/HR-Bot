import { PrismaClient, UserRole, CampaignStatus, EmploymentType, SkillLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hrbot.com' },
    update: {},
    create: { email: 'admin@hrbot.com', passwordHash, fullName: 'HR Bot Admin', role: UserRole.ADMIN },
  });
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@hrbot.com' },
    update: {},
    create: { email: 'recruiter@hrbot.com', passwordHash, fullName: 'Demo Recruiter', role: UserRole.RECRUITER },
  });

  const skills = await Promise.all(['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Redis'].map((name) =>
    prisma.skill.upsert({ where: { name }, update: {}, create: { name, category: name === 'PostgreSQL' ? 'Database' : 'Technical' } }),
  ));

  const existingPosition = await prisma.jobPosition.findFirst({ where: { title: 'Senior Full Stack Developer' } });
  const position = existingPosition ?? await prisma.jobPosition.create({
    data: {
      title: 'Senior Full Stack Developer',
      department: 'Engineering',
      employmentType: EmploymentType.FULL_TIME,
      seniority: 'senior',
      createdById: recruiter.id,
      jobDescription: {
        create: {
          overview: 'Build and maintain HR Bot web services and AI-assisted screening workflows.',
          responsibilities: 'Design APIs, integrate PostgreSQL/Redis/MinIO, build reliable background workers.',
          requirements: 'Strong TypeScript, Node.js, React, PostgreSQL and Docker experience.',
          benefits: 'Hybrid work and modern engineering culture.',
          experienceRequired: 4,
          educationRequired: 'Bachelor in Computer Science or equivalent',
        },
      },
      positionSkills: {
        create: skills.map((skill, index) => ({ skillId: skill.id, requiredLevel: SkillLevel.INTERMEDIATE, weight: index < 3 ? 2 : 1, isRequired: index < 4 })),
      },
    },
  });

  const existingCampaign = await prisma.recruitmentCampaign.findFirst({ where: { title: 'Senior Full Stack Developer - 2026' } });
  if (!existingCampaign) {
    await prisma.recruitmentCampaign.create({
      data: {
        title: 'Senior Full Stack Developer - 2026',
        description: 'Main demo recruitment campaign.',
        department: 'Engineering',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.ACTIVE,
        createdById: recruiter.id,
        campaignPositions: { create: { positionId: position.id, vacancies: 3 } },
        applicationForm: { create: { publicToken: uuid(), isPublic: true } },
      },
    });
  }

  console.log({ admin: admin.email, recruiter: recruiter.email });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
