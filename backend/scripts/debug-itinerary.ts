// Ad-hoc debug script — prints the RAW final content + finish_reason from
// AiOrchestrator.run() for the plan-itinerary prompt, to diagnose why
// AiService.generateItinerary() reports "invalid JSON" with the LLM.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

import configFactory, { AppConfig, validateEnv } from '../src/core/config';
import { AiModule } from '../src/app/ai/ai.module';
import { AiOrchestrator } from '../src/app/ai/ai.orchestrator';
import { TripProfile } from '../src/app/ai/schemas';

const PLAN_ITINERARY_PROMPT = readFileSync(
  join(__dirname, '..', 'src', 'app', 'ai', 'prompts', 'plan-itinerary.md'),
  'utf-8',
);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env'], load: [configFactory], validate: validateEnv }),
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
  const orchestrator = app.get(AiOrchestrator);

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

  const userMessage =
    `Profil voyageur : ${profile.travelers} voyageur(s), ${profile.durationDays} jours, villes : ${profile.cities.join(', ')}. ` +
    `Budget total : ${profile.budgetTotal} ${profile.currency}. Intérêts : ${profile.interests.join(', ')}. Langue de réponse : fr.`;

  const { content } = await orchestrator.run(
    [
      { role: 'system' as const, content: PLAN_ITINERARY_PROMPT },
      { role: 'user' as const, content: userMessage },
    ],
    profile,
  );

  console.log('--- RAW content (length', content.length, ') ---');
  console.log(content);
  console.log('--- end ---');

  try {
    JSON.parse(content);
    console.log('\n✓ JSON.parse direct OK');
  } catch (e) {
    console.log('\n✗ JSON.parse direct failed:', (e as Error).message);
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    console.log('  indexOf("{") =', start, ' lastIndexOf("}") =', end);
    if (start !== -1 && end !== -1) {
      try {
        JSON.parse(content.slice(start, end + 1));
        console.log('  ✓ JSON.parse on sliced {...} OK');
      } catch (e2) {
        console.log('  ✗ JSON.parse on sliced {...} failed:', (e2 as Error).message);
      }
    }
  }

  await app.close();
}

main().catch((error) => {
  console.error('ÉCHEC:', error);
  process.exit(1);
});
