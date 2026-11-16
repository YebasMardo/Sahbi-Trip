// Standalone end-to-end smoke test for the new trip-view / CRUD surface —
// not part of the app or the build. Boots a minimal Nest context (Config +
// Mongoose + TripsModule, which pulls in Activities/Restaurants/Budget/Ai)
// against the seeded Atlas cluster. Run with `npm run test:trip-view`.
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(__dirname, '..', '..', '.env') });

import configFactory, { AppConfig, validateEnv } from '../src/core/config';
import { TripsModule } from '../src/app/trips/trips.module';
import { TripsService } from '../src/app/trips/trips.service';
import { TripViewService } from '../src/app/trips/trip-view.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env'], load: [configFactory], validate: validateEnv }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({ uri: config.get('MONGODB_URI') }),
    }),
    TripsModule,
  ],
})
class TestHarnessModule {}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(TestHarnessModule, { logger: ['error', 'warn'] });
  const tripsService = app.get(TripsService);
  const tripViewService = app.get(TripViewService);

  const userId = new Types.ObjectId().toString();

  section('create');
  const trip = await tripsService.create(userId, {
    title: 'Test voyage',
    startDate: '2026-10-10',
    endDate: '2026-10-11',
    durationDays: 2,
    travelers: 2,
    budgetTotal: 3000,
    cities: ['Marrakech'],
    interests: ['culture', 'nature'],
  } as any);
  const tripId = trip._id.toString();
  console.log('trip id:', tripId);

  section('view (pre-generation, empty days)');
  const emptyView = await tripViewService.getView(tripId, userId);
  console.log('days:', emptyView.days.map((d) => ({ day: d.dayNumber, city: d.city, activities: d.activities.length })));

  section('generate() — LLM itinerary, ~1-2min');
  const started = Date.now();
  await tripsService.generate(tripId, userId);
  console.log(`generate() done in ${Date.now() - started}ms`);

  section('view (proposal preview, pre-confirm)');
  const proposalView = await tripViewService.getView(tripId, userId);
  console.log('status:', proposalView.status, '| activitiesRetained:', proposalView.activitiesRetained);
  console.log('day 1 activities:', proposalView.days[0]?.activities.map((a) => `${a.startTime} ${a.name} (${a.kind})`));

  section('confirm() — freezes selection + dashboard narrative, ~15-30s');
  const confirmStarted = Date.now();
  await tripsService.confirm(tripId, userId);
  console.log(`confirm() done in ${Date.now() - confirmStarted}ms`);

  section('view (confirmed, full)');
  const confirmedView = await tripViewService.getView(tripId, userId);
  console.log(JSON.stringify(confirmedView, null, 2));

  section('CRUD — add transport leg (no LLM call)');
  const crudStarted = Date.now();
  const transportLeg = await tripsService.addTransportLeg(tripId, userId, {
    day: 1,
    city: 'Casablanca',
    fromCity: 'Marrakech',
    toCity: 'Casablanca',
    mode: 'car',
    startTime: '07:00',
    endTime: '09:00',
  } as any);
  console.log('added transport leg:', transportLeg._id.toString(), transportLeg.estimatedCost);

  section('CRUD — add catalogue activity');
  const added = await tripsService.addActivity(tripId, userId, {
    type: 'activity',
    refId: 'marrakech-jardin-majorelle',
    day: 1,
    startTime: '16:00',
    endTime: '17:15',
  } as any);
  console.log('added activity:', added._id.toString(), added.refId, added.estimatedCost);

  section('CRUD — patch schedule + status');
  await tripsService.updateActivity(tripId, userId, added._id.toString(), { startTime: '16:30', endTime: '17:45' } as any);
  await tripsService.updateActivity(tripId, userId, added._id.toString(), { status: 'visited' } as any);
  console.log('patched schedule + status on', added._id.toString());

  section('CRUD — delete transport leg');
  await tripsService.deleteActivity(tripId, userId, transportLeg._id.toString());
  console.log(`CRUD round-trip done in ${Date.now() - crudStarted}ms (should be near-instant, no LLM call)`);

  section('view (after CRUD, recomputed live)');
  const finalView = await tripViewService.getView(tripId, userId);
  console.log('activitiesRetained:', finalView.activitiesRetained);
  console.log('budgetCategories:', finalView.budgetCategories);
  console.log('day 1 activities:', finalView.days[0]?.activities.map((a) => `${a.startTime}-${a.endTime} ${a.name} [${a.status}]`));

  await app.close();
}

main().catch((error) => {
  console.error('ÉCHEC:', error);
  process.exit(1);
});
