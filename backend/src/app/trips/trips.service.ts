import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivitiesService } from 'src/app/activities/activities.service';
import { RestaurantsService } from 'src/app/restaurants/restaurants.service';
import { BudgetService } from 'src/app/budget/budget.service';
import { AiService } from 'src/app/ai/ai.service';
import { DashboardFillerService } from 'src/app/ai/dashboard-filler.service';
import { ProfileExtractorService } from 'src/app/ai/profile-extractor.service';
import { TripProfile } from 'src/app/ai/schemas';
import { estimateTransportCost } from 'src/app/ai/transport-pricing.util';
import { Trip, TripDocument, TripStatusEnum } from './schemas/trip.schema';
import { TripActivity, TripActivityDocument, TripItemStatusEnum, TripItemTypeEnum } from './schemas/trip-activity.schema';
import { CreateTripDto } from './dto/create-trip.dto';
import { OptimizeTripDto } from './dto/optimize-trip.dto';
import { AddTripActivityDto } from './dto/add-trip-activity.dto';
import { AddTransportLegDto } from './dto/add-transport-leg.dto';
import { UpdateTripActivityDto } from './dto/update-trip-activity.dto';
import tripsStrings from './trips.strings';
import TripResponseCode from './constants/trip-response-code.enum';

@Injectable()
export class TripsService {
  constructor(
    @InjectModel(Trip.name) private readonly tripModel: Model<Trip>,
    @InjectModel(TripActivity.name) private readonly tripActivityModel: Model<TripActivity>,
    private readonly activitiesService: ActivitiesService,
    private readonly restaurantsService: RestaurantsService,
    private readonly profileExtractor: ProfileExtractorService,
    private readonly aiService: AiService,
    private readonly dashboardFiller: DashboardFillerService,
    private readonly budgetService: BudgetService,
  ) {}

  extractProfile(text: string): Promise<TripProfile> {
    return this.profileExtractor.extract(text);
  }

  create(userId: string, dto: CreateTripDto): Promise<TripDocument> {
    return this.tripModel.create({
      ...dto,
      owner: new Types.ObjectId(userId),
      status: TripStatusEnum.DRAFT,
    });
  }

  async findOneForOwner(id: string, userId: string): Promise<TripDocument> {
    const trip = await this.tripModel.findById(new Types.ObjectId(id)).exec();
    if (!trip) throw new NotFoundException(tripsStrings.E_TRIP_NOT_FOUND, TripResponseCode.E_TRIP_NOT_FOUND);
    if (trip.owner.toString() !== userId) {
      throw new NotFoundException(tripsStrings.E_TRIP_NOT_FOUND, TripResponseCode.E_TRIP_NOT_FOUND);
    }
    return trip;
  }

  // Guide §7 flux principal, steps 3-8 — generation is a proposal
  // (draft), never yet the confirmed dashboard.
  async generate(id: string, userId: string): Promise<TripDocument> {
    const trip = await this.findOneForOwner(id, userId);
    const profile = this.tripToProfile(trip);

    trip.status = TripStatusEnum.GENERATING;
    await trip.save();

    // GENERATING is a transient state, so it must not outlive a failed run:
    // a provider outage or rate limit would otherwise strand the trip there
    // forever, showing a spinner that never resolves and leaving
    // dashboard-status stuck on `generating`. Rolling back to DRAFT is what
    // makes the retry the wizard offers actually work.
    let itinerary: Awaited<ReturnType<typeof this.aiService.generateItinerary>>;
    try {
      itinerary = await this.aiService.generateItinerary(profile);
    } catch (error) {
      trip.status = TripStatusEnum.DRAFT;
      await trip.save();
      throw error;
    }

    trip.proposedItinerary = itinerary;
    trip.status = TripStatusEnum.GENERATED;
    trip.aiMeta = { generatedAt: new Date().toISOString() };
    await trip.save();
    return trip;
  }

  // Guide §8 Étape G — figes la sélection, remplit le dashboard.
  async confirm(id: string, userId: string): Promise<TripDocument> {
    const trip = await this.findOneForOwner(id, userId);
    if (!trip.proposedItinerary) {
      throw new BadRequestException(tripsStrings.E_NO_PROPOSAL, TripResponseCode.E_NO_PROPOSAL);
    }

    await this.tripActivityModel.deleteMany({ trip: trip._id });
    const itinerary = trip.proposedItinerary as any;
    const docs = itinerary.days.flatMap((day: any) =>
      day.items.map((item: any) => ({
        trip: trip._id,
        owner: trip.owner,
        type: item.type === 'restaurant' ? TripItemTypeEnum.RESTAURANT : TripItemTypeEnum.ACTIVITY,
        refId: item.activityId,
        day: day.day,
        city: day.city,
        startTime: item.startTime,
        durationMin: item.durationMin,
        // Validating the trip freezes the itinerary; each visit is still ahead
        // of the traveler, who confirms it place by place.
        status: TripItemStatusEnum.TO_VISIT,
        reason: item.reason,
        matchScore: item.matchScore,
        estimatedCost: item.estimatedCost,
        costIsEstimate: item.costIsEstimate,
        priceConfidence: item.priceConfidence,
      })),
    );
    const tripActivities = await this.tripActivityModel.insertMany(docs);

    trip.status = TripStatusEnum.FILLING;
    trip.validatedAt = new Date();
    await trip.save();

    // Like GENERATING above, FILLING is transient and must not survive a
    // failure — the narrative call already degrades to code-only internally,
    // so reaching this catch means something harder failed, and leaving the
    // trip in FILLING would freeze the dashboard on "en cours" for good.
    // GENERATED is the state confirm() started from, so retrying is clean:
    // it re-inserts the TripActivity rows from the same proposal.
    let dashboard: Awaited<ReturnType<typeof this.dashboardFiller.fill>>;
    try {
      dashboard = await this.dashboardFiller.fill({
        version: trip.dashboardVersion + 1,
        scope: 'all',
        travelers: trip.travelers,
        budgetTotal: trip.budgetTotal,
        language: trip.language,
        items: tripActivities.map((ta) => ({
          tripActivityId: ta._id.toString(),
          refId: ta.refId,
          type: ta.type === TripItemTypeEnum.RESTAURANT ? 'restaurant' : 'activity',
          day: ta.day,
          city: ta.city,
          startTime: ta.startTime,
          estimatedCost: ta.estimatedCost,
          costIsEstimate: ta.costIsEstimate,
          priceConfidence: ta.priceConfidence as 'high' | 'medium' | 'low' | null,
        })),
      });
    } catch (error) {
      trip.status = TripStatusEnum.GENERATED;
      await trip.save();
      throw error;
    }

    trip.dashboard = dashboard;
    trip.dashboardVersion = dashboard.version;
    trip.status = TripStatusEnum.CONFIRMED;
    await trip.save();
    return trip;
  }

  async dashboardStatus(id: string, userId: string) {
    const trip = await this.findOneForOwner(id, userId);
    return {
      status: trip.status,
      dashboardVersion: trip.dashboardVersion,
      dashboardReady: trip.status === TripStatusEnum.CONFIRMED && !!trip.dashboard,
    };
  }

  async replaceActivity(id: string, taId: string, userId: string) {
    const trip = await this.findOneForOwner(id, userId);
    const tripActivity = await this.findTripActivityForOwner(taId, userId);

    let category: string | undefined;
    let maxPrice: number | undefined;
    if (tripActivity.type === TripItemTypeEnum.ACTIVITY) {
      const [activity] = await this.activitiesService.findManyByIds([tripActivity.refId]);
      category = activity?.category;
      maxPrice = activity?.price ?? activity?.priceRange?.[1];
    }

    return this.aiService.replaceActivity({
      city: tripActivity.city,
      category: category ?? 'culture',
      excludeRefId: tripActivity.refId,
      maxPrice,
      profile: this.tripToProfile(trip),
    });
  }

  async optimize(id: string, userId: string, dto: OptimizeTripDto) {
    const trip = await this.findOneForOwner(id, userId);
    const filter: Record<string, unknown> = { trip: trip._id };
    if (dto.day) filter.day = dto.day;

    const items = await this.tripActivityModel.find(filter).exec();
    if (!items.length) return { order: [], explanation: 'Aucun élément à optimiser.' };

    const byCity = new Map<string, TripActivityDocument[]>();
    for (const item of items) {
      byCity.set(item.city, [...(byCity.get(item.city) ?? []), item]);
    }

    const results = await Promise.all(
      [...byCity.entries()].map(([city, cityItems]) =>
        this.aiService.optimizeDay({
          city,
          profile: this.tripToProfile(trip),
          items: cityItems.map((ta) => ({
            tripActivityId: ta._id.toString(),
            refId: ta.refId,
            type: ta.type === TripItemTypeEnum.RESTAURANT ? 'restaurant' : 'activity',
            startTime: ta.startTime,
          })),
        }),
      ),
    );

    const orderById = new Map(results.flatMap((r) => r.order).map((o) => [o.tripActivityId, o.startTime]));
    await Promise.all(
      items.map((item) => {
        const newStartTime = orderById.get(item._id.toString());
        if (newStartTime === undefined) return null;
        item.startTime = newStartTime;
        return item.save();
      }),
    );

    return {
      order: [...orderById.entries()].map(([tripActivityId, startTime]) => ({ tripActivityId, startTime })),
      explanation: results.map((r) => r.explanation).join(' '),
    };
  }

  async adaptBudget(id: string, userId: string, remaining: number) {
    const trip = await this.findOneForOwner(id, userId);
    if (trip.status === TripStatusEnum.CONFIRMED) {
      throw new BadRequestException(tripsStrings.E_CANNOT_ADAPT_CONFIRMED, TripResponseCode.E_CANNOT_ADAPT_CONFIRMED);
    }

    const itinerary = await this.aiService.adaptBudget(this.tripToProfile(trip), remaining);
    trip.proposedItinerary = itinerary;
    trip.status = TripStatusEnum.GENERATED;
    await trip.save();
    return trip;
  }

  async chat(id: string, userId: string, message: string) {
    const trip = await this.findOneForOwner(id, userId);
    const context =
      `Statut : ${trip.status}. Villes : ${trip.cities.join(', ')}. ` +
      `Budget : ${trip.budgetTotal} ${trip.currency}.`;
    return this.aiService.chat(this.tripToProfile(trip), context, message);
  }

  // Direct add from ActivityPicker — distinct from the AI-suggested
  // "/replace" endpoint above, which only proposes alternatives and never
  // mutates. Cost is always recomputed from the catalogue here, never
  // trusted from the client (§2 rule 3).
  async addActivity(tripId: string, userId: string, dto: AddTripActivityDto): Promise<TripActivityDocument> {
    const trip = await this.findOneForOwner(tripId, userId);

    let city: string;
    let estimatedCost: number | null;
    let costIsEstimate: boolean;
    let priceConfidence: string | null;

    if (dto.type === 'activity') {
      const [activity] = await this.activitiesService.findManyByIds([dto.refId]);
      if (!activity) throw new BadRequestException(tripsStrings.E_CATALOGUE_ITEM_NOT_FOUND, TripResponseCode.E_CATALOGUE_ITEM_NOT_FOUND);
      const resolved = this.budgetService.resolveActivityCost({
        isFree: activity.isFree,
        price: activity.price,
        priceRange: activity.priceRange,
        priceConfidence: activity.priceConfidence,
        travelers: trip.travelers,
      });
      city = activity.city;
      estimatedCost = resolved.cost;
      costIsEstimate = resolved.isEstimate;
      priceConfidence = activity.priceConfidence;
    } else {
      const [restaurant] = await this.restaurantsService.findManyByIds([dto.refId]);
      if (!restaurant) throw new BadRequestException(tripsStrings.E_CATALOGUE_ITEM_NOT_FOUND, TripResponseCode.E_CATALOGUE_ITEM_NOT_FOUND);
      const resolved = this.budgetService.resolveRestaurantCost({
        priceLevel: restaurant.priceLevel,
        avgPricePerPerson: restaurant.avgPricePerPerson,
        travelers: trip.travelers,
      });
      city = restaurant.city;
      estimatedCost = resolved.cost;
      costIsEstimate = resolved.isEstimate;
      priceConfidence = null;
    }

    return this.tripActivityModel.create({
      trip: trip._id,
      owner: trip.owner,
      type: dto.type === 'restaurant' ? TripItemTypeEnum.RESTAURANT : TripItemTypeEnum.ACTIVITY,
      refId: dto.refId,
      day: dto.day,
      city,
      startTime: dto.startTime,
      durationMin: durationBetween(dto.startTime, dto.endTime),
      status: TripItemStatusEnum.TO_VISIT,
      estimatedCost,
      costIsEstimate,
      priceConfidence,
    });
  }

  // Priced via the same deterministic table the AI's estimateTransportCost
  // tool uses (transport-pricing.util.ts) — never invented.
  async addTransportLeg(tripId: string, userId: string, dto: AddTransportLegDto): Promise<TripActivityDocument> {
    const trip = await this.findOneForOwner(tripId, userId);
    const { cost } = estimateTransportCost(dto.fromCity, dto.toCity, dto.mode);
    const label = dto.label?.trim() || `Trajet ${dto.fromCity} → ${dto.toCity}`;

    return this.tripActivityModel.create({
      trip: trip._id,
      owner: trip.owner,
      type: TripItemTypeEnum.TRANSPORT,
      refId: label,
      day: dto.day,
      city: dto.city,
      startTime: dto.startTime,
      durationMin: durationBetween(dto.startTime, dto.endTime),
      status: TripItemStatusEnum.TO_VISIT,
      estimatedCost: cost,
      costIsEstimate: true,
      priceConfidence: null,
    });
  }

  // Covers reschedule / status-change / content-swap in one PATCH — see
  // UpdateTripActivityDto. A content-swap resets status to TO_VISIT: a
  // fresh place to visit, matching the frontend's replaceActivityInDay.
  async updateActivity(tripId: string, userId: string, taId: string, dto: UpdateTripActivityDto): Promise<TripActivityDocument> {
    const trip = await this.findOneForOwner(tripId, userId);
    const item = await this.findTripActivityForOwner(taId, userId);
    this.assertBelongsToTrip(item, trip);

    if (dto.refId && dto.type) {
      if (dto.type === 'activity') {
        const [activity] = await this.activitiesService.findManyByIds([dto.refId]);
        if (!activity) throw new BadRequestException(tripsStrings.E_CATALOGUE_ITEM_NOT_FOUND, TripResponseCode.E_CATALOGUE_ITEM_NOT_FOUND);
        const resolved = this.budgetService.resolveActivityCost({
          isFree: activity.isFree,
          price: activity.price,
          priceRange: activity.priceRange,
          priceConfidence: activity.priceConfidence,
          travelers: trip.travelers,
        });
        item.type = TripItemTypeEnum.ACTIVITY;
        item.refId = dto.refId;
        item.city = activity.city;
        item.estimatedCost = resolved.cost;
        item.costIsEstimate = resolved.isEstimate;
        item.priceConfidence = activity.priceConfidence;
      } else {
        const [restaurant] = await this.restaurantsService.findManyByIds([dto.refId]);
        if (!restaurant) throw new BadRequestException(tripsStrings.E_CATALOGUE_ITEM_NOT_FOUND, TripResponseCode.E_CATALOGUE_ITEM_NOT_FOUND);
        const resolved = this.budgetService.resolveRestaurantCost({
          priceLevel: restaurant.priceLevel,
          avgPricePerPerson: restaurant.avgPricePerPerson,
          travelers: trip.travelers,
        });
        item.type = TripItemTypeEnum.RESTAURANT;
        item.refId = dto.refId;
        item.city = restaurant.city;
        item.estimatedCost = resolved.cost;
        item.costIsEstimate = resolved.isEstimate;
        item.priceConfidence = null;
      }
      item.status = TripItemStatusEnum.TO_VISIT;
      item.matchScore = null;
      item.reason = null;
    }

    if (dto.startTime && dto.endTime) {
      item.startTime = dto.startTime;
      item.durationMin = durationBetween(dto.startTime, dto.endTime);
    }

    if (dto.status) {
      item.status = dto.status;
    }

    await item.save();
    return item;
  }

  async deleteActivity(tripId: string, userId: string, taId: string): Promise<void> {
    const trip = await this.findOneForOwner(tripId, userId);
    const item = await this.findTripActivityForOwner(taId, userId);
    this.assertBelongsToTrip(item, trip);
    await item.deleteOne();
  }

  private assertBelongsToTrip(item: TripActivityDocument, trip: TripDocument): void {
    if (item.trip.toString() !== trip._id.toString()) {
      throw new NotFoundException(tripsStrings.E_TRIP_ACTIVITY_NOT_FOUND, TripResponseCode.E_TRIP_ACTIVITY_NOT_FOUND);
    }
  }

  private async findTripActivityForOwner(id: string, userId: string): Promise<TripActivityDocument> {
    const item = await this.tripActivityModel.findById(new Types.ObjectId(id)).exec();
    if (!item) {
      throw new NotFoundException(tripsStrings.E_TRIP_ACTIVITY_NOT_FOUND, TripResponseCode.E_TRIP_ACTIVITY_NOT_FOUND);
    }
    const ownerId = '_id' in item.owner ? item.owner._id : item.owner;
    if (ownerId.toString() !== userId) {
      throw new NotFoundException(tripsStrings.E_TRIP_ACTIVITY_NOT_FOUND, TripResponseCode.E_TRIP_ACTIVITY_NOT_FOUND);
    }
    return item;
  }

  private tripToProfile(trip: TripDocument): TripProfile {
    return {
      startDate: trip.startDate,
      endDate: trip.endDate,
      durationDays: trip.durationDays,
      travelers: trip.travelers,
      budgetTotal: trip.budgetTotal,
      budgetAccommodation: trip.budgetAccommodation ?? null,
      currency: trip.currency,
      cities: trip.cities,
      interests: trip.interests,
      avoid: trip.avoid,
      comfort: trip.comfort,
      transport: trip.transport,
      cityDurations: trip.cityDurations ?? [],
      intercityTransport: trip.intercityTransport,
      travelerType: trip.travelerType,
      alreadyInMorocco: trip.alreadyInMorocco,
      currentCity: trip.currentCity,
      pace: trip.pace,
      dietary: trip.dietary,
      budgetActivities: trip.budgetActivities ?? null,
      travelNotes: trip.travelNotes,
      language: trip.language,
    };
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function durationBetween(startTime: string, endTime: string): number {
  return Math.max(timeToMinutes(endTime) - timeToMinutes(startTime), 0);
}
