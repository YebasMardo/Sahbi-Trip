import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ISendMailOptions } from '@nestjs-modules/mailer';
import { EmailMessengerService } from './email-messenger.service';

@Processor('messenger')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly emailMessenger: EmailMessengerService) {
    super();
  }

  async process(job: Job<ISendMailOptions>): Promise<void> {
    this.logger.debug(`${job.name} processing job ${job.id}`);
    await this.emailMessenger.send(job.data);
    this.logger.debug(`${job.name} completed job ${job.id}`);
  }
}
