import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { MongoIdDto } from 'src/core/dtos/mongoId.dto';
import { SuccessResponse, SuccessResponseEnum } from 'src/core/httpResponse/SuccessResponse';
import { TripsService } from './trips.service';
import { TripViewService } from './trip-view.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { ExtractProfileDto } from './dto/extract-profile.dto';
import { OptimizeTripDto } from './dto/optimize-trip.dto';
import { AdaptBudgetDto } from './dto/adapt-budget.dto';
import { ChatTripDto } from './dto/chat-trip.dto';
import { AddTripActivityDto } from './dto/add-trip-activity.dto';
import { AddTransportLegDto } from './dto/add-transport-leg.dto';
import { UpdateTripActivityDto } from './dto/update-trip-activity.dto';

@ApiTags('Trips')
@ApiBearerAuth()
@Controller('/api/v1/trips')
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly tripViewService: TripViewService,
  ) {}

  @Post('/extract-profile')
  async extractProfile(@Body() dto: ExtractProfileDto) {
    const profile = await this.tripsService.extractProfile(dto.text);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, profile);
  }

  @Post('/')
  async create(@Req() request: Request, @Body() dto: CreateTripDto) {
    const trip = await this.tripsService.create(request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.CREATED, 'Voyage créé avec succès.', trip);
  }

  // Owner-scoped list, frontend-shaped (TripsListPage / DashboardHomePage).
  @Get('/')
  async list(@Req() request: Request) {
    const trips = await this.tripViewService.listViews(request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, trips);
  }

  @Get('/:id')
  async findOne(@Req() request: Request, @Param() { id }: MongoIdDto) {
    const trip = await this.tripsService.findOneForOwner(id, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, trip);
  }

  // Full denormalized Trip/DayPlan/ActivityItem view, matching the frontend
  // mock's shape (frontend/src/data/trips.ts) — works before confirm() too,
  // previewing the AI's proposedItinerary directly.
  @Get('/:id/view')
  async view(@Req() request: Request, @Param() { id }: MongoIdDto) {
    const trip = await this.tripViewService.getView(id, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, trip);
  }

  @Post('/:id/generate')
  async generate(@Req() request: Request, @Param() { id }: MongoIdDto) {
    const trip = await this.tripsService.generate(id, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, trip);
  }

  @Post('/:id/confirm')
  async confirm(@Req() request: Request, @Param() { id }: MongoIdDto) {
    const trip = await this.tripsService.confirm(id, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, 'Voyage confirmé.', trip);
  }

  @Get('/:id/dashboard-status')
  async dashboardStatus(@Req() request: Request, @Param() { id }: MongoIdDto) {
    const status = await this.tripsService.dashboardStatus(id, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, status);
  }

  // Adds a catalogue place picked directly from ActivityPicker — mutates,
  // unlike the AI-suggested "/replace" below which only proposes.
  @Post('/:id/activities')
  async addActivity(@Req() request: Request, @Param() { id }: MongoIdDto, @Body() dto: AddTripActivityDto) {
    const item = await this.tripsService.addActivity(id, request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.CREATED, undefined, item);
  }

  @Post('/:id/activities/transport')
  async addTransportLeg(@Req() request: Request, @Param() { id }: MongoIdDto, @Body() dto: AddTransportLegDto) {
    const item = await this.tripsService.addTransportLeg(id, request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.CREATED, undefined, item);
  }

  // Reschedule / status-change / content-swap — see UpdateTripActivityDto.
  @HttpCode(HttpStatus.OK)
  @Patch('/:id/activities/:taId')
  async updateActivity(
    @Req() request: Request,
    @Param() { id }: MongoIdDto,
    @Param('taId') taId: string,
    @Body() dto: UpdateTripActivityDto,
  ) {
    const item = await this.tripsService.updateActivity(id, request.user.sub, taId, dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, item);
  }

  @HttpCode(HttpStatus.OK)
  @Delete('/:id/activities/:taId')
  async deleteActivity(@Req() request: Request, @Param() { id }: MongoIdDto, @Param('taId') taId: string) {
    await this.tripsService.deleteActivity(id, request.user.sub, taId);
    return new SuccessResponse(SuccessResponseEnum.OK, 'Élément supprimé.', undefined);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/:id/activities/:taId/replace')
  async replaceActivity(
    @Req() request: Request,
    @Param() { id }: MongoIdDto,
    @Param('taId') taId: string,
  ) {
    const alternatives = await this.tripsService.replaceActivity(id, taId, request.user.sub);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, { alternatives });
  }

  @HttpCode(HttpStatus.OK)
  @Post('/:id/optimize')
  async optimize(@Req() request: Request, @Param() { id }: MongoIdDto, @Body() dto: OptimizeTripDto) {
    const result = await this.tripsService.optimize(id, request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, result);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/:id/adapt-budget')
  async adaptBudget(@Req() request: Request, @Param() { id }: MongoIdDto, @Body() dto: AdaptBudgetDto) {
    const trip = await this.tripsService.adaptBudget(id, request.user.sub, dto.remaining);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, trip);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/:id/chat')
  async chat(@Req() request: Request, @Param() { id }: MongoIdDto, @Body() dto: ChatTripDto) {
    const result = await this.tripsService.chat(id, request.user.sub, dto.message);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, result);
  }
}
