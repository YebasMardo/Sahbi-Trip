// Standalone end-to-end smoke test — not part of the app or the build.
// Boots a minimal Nest context (Config + Mongoose + AiModule only, no
// Redis/Mail/Auth) against the seeded Atlas cluster and drives a real
// AiService.generateItinerary() call through Anthropic + Voyage. Run with
// `npm run test:itinerary`.
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

import configFactory, { AppConfig, validateEnv } from '../src/core/config';
import { AiModule } from '../src/app/ai/ai.module';
import { AiService } from '../src/app/ai/ai.service';
import { TripProfile } from '../src/app/ai/schemas';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env'],
      load: [configFactory],
      validate: validateEnv,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({ uri: config.get('MONGODB_URI') }),
    }),
    AiModule,
  ],
})
class TestHarnessModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(TestHarnessModule, { logger: ['error', 'warn'] });
  const aiService = app.get(AiService);

  const profile: TripProfile = {
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    durationDays: 2,
    travelers: 2,
    budgetTotal: 3000,
    budgetAccommodation: null,
    dietary: [],
    currency: 'MAD',
    cities: ['Marrakech'],
    interests: ['culture', 'nature'],
    avoid: [],
    comfort: null,
    transport: null,
    travelerType: null,
    alreadyInMorocco: false,
    currentCity: null,
    language: 'fr',
  };

  console.log('Génération d\'un itinéraire (Marrakech, 2 jours, 2 voyageurs, budget 3000 MAD)...\n');
  const started = Date.now();
  const itinerary = await aiService.generateItinerary(profile);
  console.log(`Terminé en ${Date.now() - started}ms.\n`);
  console.log(JSON.stringify(itinerary, null, 2));

  await app.close();
}

main().catch((error) => {
  console.error('ÉCHEC:', error);
  process.exit(1);
});
