import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesModule } from 'src/app/activities/activities.module';
import { RestaurantsModule } from 'src/app/restaurants/restaurants.module';
import { BudgetModule } from 'src/app/budget/budget.module';
import { AiModule } from 'src/app/ai/ai.module';
import { Trip, TripSchema } from './schemas/trip.schema';
import { TripActivity, TripActivitySchema } from './schemas/trip-activity.schema';
import { TripsService } from './trips.service';
import { TripViewService } from './trip-view.service';
import { WeatherStubService } from './weather-stub.service';
import { TripsController } from './trips.controller';
import { ContextualChatController } from './contextual-chat.controller';
import { ContextualChatService } from './contextual-chat.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Trip.name, schema: TripSchema },
      { name: TripActivity.name, schema: TripActivitySchema },
    ]),
    ActivitiesModule,
    RestaurantsModule,
    BudgetModule,
    AiModule,
  ],
  controllers: [TripsController, ContextualChatController],
  providers: [TripsService, TripViewService, WeatherStubService, ContextualChatService],
})
export class TripsModule {}
