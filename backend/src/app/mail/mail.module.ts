import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailMessengerService } from './email-messenger.service';
import { MailProcessor } from './mail.processor';

// @Global() — messaging is cross-cutting infra, one of the exceptions to
// "never mark a business-domain module @Global()".
@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'messenger',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    }),
  ],
  providers: [EmailMessengerService, MailProcessor],
  exports: [EmailMessengerService],
})
export class MailModule {}
