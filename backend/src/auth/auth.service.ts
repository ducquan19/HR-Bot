import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new BadRequestException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.name,
        role: UserRole.RECRUITER,
        isActive: true,
        isEmailVerified: false,
      },
      select: { id: true, email: true, fullName: true, role: true, avatarUrl: true, createdAt: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    await this.mail.sendVerificationEmail(user.email, token);

    return { user: this.toFrontendUser(user), message: 'Please check your email to verify your account.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user?.passwordHash || !user.isActive) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email chưa được xác thực');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    return { user: this.toFrontendUser(user), ...tokens };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toFrontendUser(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' };

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    await this.mail.sendPasswordReset(user.email, token);
    return { message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokens = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    const match = await this.findMatchingToken(tokens, dto.token);
    if (!match) throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: match.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: match.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: match.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Mật khẩu đã được đặt lại thành công' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) throw new BadRequestException('Tài khoản này không có mật khẩu');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    const same = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (same) throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Đổi mật khẩu thành công' };
  }

  async verifyEmail(token: string) {
    const tokens = await this.prisma.emailVerificationToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    const match = await this.findMatchingToken(tokens, token);
    if (!match) throw new BadRequestException('Token xác thực không hợp lệ hoặc đã hết hạn');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: match.userId }, data: { isEmailVerified: true } }),
      this.prisma.emailVerificationToken.update({ where: { id: match.id }, data: { usedAt: new Date() } }),
    ]);

    return { message: 'Email đã được xác thực thành công' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.isEmailVerified) return { message: 'Nếu email tồn tại và chưa được xác thực, một đường dẫn đã được gửi.' };

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.mail.sendVerificationEmail(user.email, token);
    return { message: 'Nếu email tồn tại và chưa được xác thực, một đường dẫn đã được gửi.' };
  }

  private async issueTokens(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl'),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshTtl'),
    });
    await this.prisma.refreshToken.create({
      data: {
        userId: userId,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private async findMatchingToken<T extends { tokenHash: string }>(tokens: T[], rawToken: string): Promise<T | null> {
    for (const token of tokens) {
      if (await bcrypt.compare(rawToken, token.tokenHash)) return token;
    }
    return null;
  }

  private toFrontendUser(user: { id: string; email: string; fullName: string; role: UserRole; avatarUrl?: string | null; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role.toLowerCase(),
      avatar: user.avatarUrl ?? undefined,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
