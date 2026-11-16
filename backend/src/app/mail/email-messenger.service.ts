import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { UserDocument } from 'src/app/users/schemas/user.schema';

@Injectable()
export class EmailMessengerService {
  private readonly logger = new Logger(EmailMessengerService.name);

  constructor(
    private readonly mailerService: MailerService,
    @InjectQueue('messenger') private readonly queue: Queue,
  ) {}

  // LAYER 1 — domain: knows what this email type means. Enqueues.
  async sendWelcomeEmail(user: Pick<UserDocument, 'email' | 'fullname'>) {
    return this.queue.add('send-email', {
      to: `"${user.fullname}" <${user.email}>`,
      subject: 'Bienvenue sur Sahbi Trip !',
      template: 'welcome-email',
      context: { name: user.fullname },
    } satisfies ISendMailOptions);
  }

  async sendOtpEmail(params: {
    user: Pick<UserDocument, 'email' | 'fullname'>;
    title: string;
    code: string;
    ttlMinutes: number;
  }) {
    return this.queue.add('send-email', {
      to: `"${params.user.fullname}" <${params.user.email}>`,
      subject: params.title,
      template: 'otp-email',
      context: {
        name: params.user.fullname,
        title: params.title,
        code: params.code,
        ttlMinutes: params.ttlMinutes,
      },
    } satisfies ISendMailOptions);
  }

  // LAYER 2 — transport: knows how to deliver anything.
  async send(options: ISendMailOptions) {
    try {
      return await this.mailerService.sendMail(options);
    } catch (error) {
      this.logger.error(
        `sendMail failed to ${options.to as string}: ${(error as Error)?.message}`,
      );
      throw error; // let Bull retry
    }
  }
}
