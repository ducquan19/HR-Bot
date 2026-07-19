import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }).then((users) => users.map((user) => this.toFrontendUser(user)));
  }

  findAssignable() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { in: [UserRole.ADMIN, UserRole.RECRUITER] } },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { fullName: 'asc' },
    }).then((users) => users.map((user) => this.toFrontendUser(user)));
  }

  updateRole(id: string, role: UserRole) {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  private toFrontendUser(user: { id: string; email: string; fullName: string; role: UserRole; isActive: boolean; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role.toLowerCase(),
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
