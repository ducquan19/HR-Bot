import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private createTransport() {
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    return nodemailer.createTransport({
      host: this.config.get<string>('mail.host'),
      port: this.config.get<number>('mail.port'),
      secure: false,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    const url = `${frontendUrl}/reset-password?token=${token}`;
    await this.safeSend(email, 'Reset your HR Bot password', `Open this link to reset your password: ${url}`);
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.config.get<string>('frontendUrl');
    const url = `${frontendUrl}/verify-email?token=${token}`;
    await this.safeSend(email, 'Verify your HR Bot email', `Welcome to HR Bot! Please open this link to verify your email address: ${url}`);
  }

  async sendInterviewInvite(email: string, link: string) {
    await this.safeSend(email, 'HR Bot virtual interview invitation', `You have been invited to a virtual interview: ${link}`);
  }

  private async safeSend(to: string, subject: string, text: string) {
    try {
      await this.createTransport().sendMail({
        from: this.config.get<string>('mail.from'),
        to,
        subject,
        text,
      });
    } catch (error) {
      this.logger.warn(`Email not sent to ${to}: ${(error as Error).message}`);
    }
  }
}
