import { PrismaClient, UserRole, CampaignStatus, EmploymentType, SkillLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Nguyễn Văn', 'Trần Thị', 'Lê Minh', 'Phạm Thị', 'Hoàng Đức',
  'Vũ Thị', 'Đặng Quốc', 'Bùi Thị', 'Đỗ Minh', 'Ngô Thị',
  'Dương Văn', 'Lý Thị', 'Hồ Minh', 'Đinh Thị', 'Trương Công',
  'Võ Thị', 'Huỳnh Minh', 'Lâm Thị', 'Phan Văn', 'Chu Thị',
];
const LAST_NAMES = [
  'An', 'Bình', 'Chi', 'Dũng', 'Em',
  'Giang', 'Hà', 'Khoa', 'Lan', 'Minh',
  'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn',
  'Tâm', 'Uyên', 'Vinh', 'Xuân', 'Yến',
  'Hương', 'Thành', 'Long', 'Linh', 'Hùng',
  'Thảo', 'Tùng', 'Mai', 'Khánh', 'Đức',
];

function randomName(index: number): { firstName: string; lastName: string } {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index * 1.7 + 3) % LAST_NAMES.length];
  return { firstName: first, lastName: last };
}

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

  const skillNames = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'Redis', 'Python', 'AWS', 'Kubernetes', 'Java', 'C++', 'Go', 'Figma', 'UI/UX'];
  const skills = await Promise.all(skillNames.map((name) =>
    prisma.skill.upsert({ where: { name }, update: {}, create: { name, category: ['Figma', 'UI/UX'].includes(name) ? 'Design' : 'Technical' } }),
  ));

  const jobPositionsData = [
    { title: 'Senior Full Stack Developer', dept: 'Engineering', skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'] },
    { title: 'Backend Engineer', dept: 'Engineering', skills: ['Python', 'PostgreSQL', 'Docker', 'AWS'] },
    { title: 'Frontend Developer', dept: 'Engineering', skills: ['React', 'TypeScript', 'Figma'] },
    { title: 'DevOps Engineer', dept: 'Platform', skills: ['Docker', 'Kubernetes', 'AWS', 'Go'] },
    { title: 'Product Designer', dept: 'Design', skills: ['Figma', 'UI/UX'] },
  ];

  const positions = [];
  for (const posData of jobPositionsData) {
    const existing = await prisma.jobPosition.findFirst({ where: { title: posData.title } });
    if (existing) {
      positions.push(existing);
      continue;
    }
    const pos = await prisma.jobPosition.create({
      data: {
        title: posData.title,
        department: posData.dept,
        employmentType: EmploymentType.FULL_TIME,
        seniority: posData.title.includes('Senior') ? 'senior' : 'mid',
        createdById: recruiter.id,
        jobDescription: {
          create: {
            overview: `We are looking for a ${posData.title} to join our ${posData.dept} team.`,
            responsibilities: 'Develop, maintain, and innovate our core products.',
            requirements: `Strong experience in ${posData.skills.join(', ')}.`,
            benefits: 'Remote work, health insurance, free lunch.',
            experienceRequired: posData.title.includes('Senior') ? 5 : 2,
            educationRequired: 'Bachelor degree in a related field',
          }
        },
        positionSkills: {
          create: posData.skills.map((skillName) => {
            const skill = skills.find(s => s.name === skillName)!;
            return { skillId: skill.id, requiredLevel: SkillLevel.INTERMEDIATE, weight: 1, isRequired: true };
          }),
        },
      }
    });
    positions.push(pos);
  }

  const campaigns = [];
  for (let i = 0; i < 5; i++) {
    const campaignTitle = `Q${(i % 4) + 1} 2026 Hiring - ${positions[i].department}`;
    const existing = await prisma.recruitmentCampaign.findFirst({ where: { title: campaignTitle } });
    if (existing) {
      const dbCampaign = await prisma.recruitmentCampaign.findUnique({ where: { id: existing.id }, include: { campaignPositions: true } });
      campaigns.push(dbCampaign!);
      continue;
    }
    
    const camp = await prisma.recruitmentCampaign.create({
      data: {
        title: campaignTitle,
        description: `Main recruitment campaign for ${positions[i].department}.`,
        department: positions[i].department,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: CampaignStatus.ACTIVE,
        createdById: recruiter.id,
        campaignPositions: { create: { positionId: positions[i].id, vacancies: Math.floor(Math.random() * 5) + 1 } },
        applicationForm: { create: { publicToken: uuid(), isPublic: true } },
      },
      include: { campaignPositions: true },
    });
    campaigns.push(camp);
  }

  const stages = ['APPLIED', 'SCREENING', 'VIRTUAL_INTERVIEW', 'HR_REVIEW', 'TEST', 'REAL_INTERVIEW', 'OFFER', 'REJECTED'];
  const recommendations = ['STRONG_RECOMMEND', 'RECOMMEND', 'CONSIDER', 'REJECT'];

  // Score distribution: realistic bell curve 40-95%
  // overallScore is stored on scale 0-10000 (divide by 100 to get %)
  const scoreDistributions = [
    { min: 8500, max: 9800 }, // top tier ~15%
    { min: 7000, max: 8500 }, // good ~30%
    { min: 5500, max: 7000 }, // average ~35%
    { min: 3000, max: 5500 }, // below average ~20%
  ];
  const weights = [15, 30, 35, 20];
  
  function weightedRandomScore(): number {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (let w = 0; w < weights.length; w++) {
      cumulative += weights[w];
      if (rand <= cumulative) {
        const { min, max } = scoreDistributions[w];
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
    return 6000;
  }

  console.log("Seeding candidates...");
  for (let i = 0; i < 50; i++) {
    const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
    const campaignPosition = campaign.campaignPositions[0];
    
    // Pick 2-5 random skills
    const numSkills = Math.floor(Math.random() * 4) + 2;
    const shuffledSkills = [...skills].sort(() => 0.5 - Math.random());
    const candidateSkills = shuffledSkills.slice(0, numSkills);

    const { firstName, lastName } = randomName(i);

    const overallScore = weightedRandomScore();
    const skillScore = Math.min(10000, Math.max(0, overallScore + Math.floor((Math.random() - 0.5) * 2000)));
    const experienceScore = Math.min(10000, Math.max(0, overallScore + Math.floor((Math.random() - 0.5) * 2500)));
    const educationScore = Math.min(10000, Math.max(0, overallScore + Math.floor((Math.random() - 0.5) * 1500)));

    const profile = await prisma.candidateProfile.create({
      data: {
        firstName,
        lastName,
        email: `candidate-${uuid()}@example.com`,
        phone: `+84${Math.floor(Math.random() * 900000000) + 100000000}`,
        skills: {
          create: candidateSkills.map(s => ({ skillId: s.id }))
        },
        experiences: {
          create: [
            { title: 'Software Engineer', company: 'Tech Corp', years: Math.floor(Math.random() * 8) + 1 }
          ]
        },
        education: {
          create: [
            { degree: "Bachelor's", school: "Tech University", endYear: 2020 }
          ]
        },
      }
    });

    const cv = await prisma.cv.create({
      data: {
        candidateProfileId: profile.id,
        originalFilename: 'cv.pdf',
        storagePath: `mock/${uuid()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'mock-checksum',
        uploadedById: recruiter.id,
        processingStatus: 'COMPLETED',
        aiExtractions: {
          create: {
            rawText: 'Extracted CV content here...',
            parsedJson: { experienceYears: Math.floor(Math.random() * 8) + 1 },
            modelName: 'mock-model',
            modelVersion: '1.0',
          }
        }
      }
    });

    await prisma.candidateApplication.create({
      data: {
        candidateProfileId: profile.id,
        campaignPositionId: campaignPosition.id,
        cvId: cv.id,
        currentStage: stages[Math.floor(Math.random() * stages.length)] as any,
        screeningResult: {
          create: {
            overallScore,
            skillScore,
            experienceScore,
            educationScore,
            recommendation: recommendations[Math.floor(Math.random() * recommendations.length)] as any,
            explanation: 'Good match based on resume and requirements.',
            strengths: ['Problem Solving', 'Teamwork'],
            weaknesses: ['Lack of specific domain knowledge'],
            missingSkills: [],
          }
        }
      }
    });
  }

  console.log("Seeding complete!");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
