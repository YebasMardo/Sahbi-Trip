import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configFactory, { AppConfig, validateEnv } from './core/config';
import { TEMPLATES_DIR } from './core/constants/dir.constants';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { RedisModule } from './core/redis/redis.module';
import { UsersModule } from './app/users/users.module';
import { TokensModule } from './app/tokens/tokens.module';
import { MailModule } from './app/mail/mail.module';
import { AuthModule } from './app/auth/auth.module';
import { ActivitiesModule } from './app/activities/activities.module';
import { RestaurantsModule } from './app/restaurants/restaurants.module';
import { BudgetModule } from './app/budget/budget.module';
import { AiModule } from './app/ai/ai.module';
import { TripsModule } from './app/trips/trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo layout: the real .env lives at the project root, one
      // level up from backend/ (shared with frontend's VITE_API_URL and
      // docker-compose.yml's variable substitution). The backend-local
      // paths are also checked in case one is ever added here directly.
      // A path that doesn't exist is silently skipped — no effect in
      // Docker, where env vars are injected straight into the container.
      envFilePath: ['../.env.local', '../.env', '.env.local', '.env'],
      load: [configFactory],
      cache: true,
      validate: validateEnv,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('MONGODB_URI'),
      }),
    }),

    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),

    // Pinned to a dedicated logical Redis database and connection name so
    // queue keys stay isolated from anything else sharing the instance.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          db: 2,
          connectionName: 'bull-module',
        },
      }),
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        transport: {
          host: config.get('MAIL_HOST'),
          port: config.get('MAIL_PORT'),
          secure: false,
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"${config.get('APP_NAME')}" <${config.get('MAIL_FROM')}>`,
        },
        template: {
          dir: join(TEMPLATES_DIR, 'emails'),
          adapter: new HandlebarsAdapter(),
          options: { strict: true },
        },
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    RedisModule,
    UsersModule,
    TokensModule,
    MailModule,
    AuthModule,
    ActivitiesModule,
    RestaurantsModule,
    BudgetModule,
    AiModule,
    TripsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
