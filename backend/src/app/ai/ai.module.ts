import { Module } from '@nestjs/common';
import { ActivitiesModule } from 'src/app/activities/activities.module';
import { RestaurantsModule } from 'src/app/restaurants/restaurants.module';
import { BudgetModule } from 'src/app/budget/budget.module';
import { LlmClient } from './llm.client';
import { RetrievalService } from './retrieval.service';
import { ScoringService } from './scoring.service';
import { AiOrchestrator } from './ai.orchestrator';
import { ProfileExtractorService } from './profile-extractor.service';
import { AiService } from './ai.service';
import { DashboardFillerService } from './dashboard-filler.service';
import { LlmHealthService } from './llm-health.service';
import { AiController } from './ai.controller';

// All AI lives here (guide AR "module ai reste isolé") — no dependency on
// TripsModule: every method here takes plain data (TripProfile, resolved
// catalogue items) as parameters, never a tripId. TripsModule depends on
// this module, not the other way around, so there is no import cycle.
@Module({
  imports: [ActivitiesModule, RestaurantsModule, BudgetModule],
  controllers: [AiController],
  providers: [
    LlmClient,
    RetrievalService,
    ScoringService,
    AiOrchestrator,
    ProfileExtractorService,
    AiService,
    DashboardFillerService,
    LlmHealthService,
  ],
  exports: [LlmClient, ProfileExtractorService, AiService, DashboardFillerService, LlmHealthService],
})
export class AiModule {}
