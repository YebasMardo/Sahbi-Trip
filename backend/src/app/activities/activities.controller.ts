import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicAccess } from 'src/app/auth/decorators/public-access.decorator';
import { SlugIdDto } from 'src/core/dtos/slugId.dto';
import { SuccessResponse, SuccessResponseEnum } from 'src/core/httpResponse/SuccessResponse';
import { ActivitiesService } from './activities.service';
import { PaginateActivitiesDto } from './dto/paginate-activities.dto';

// Read-only catalogue, seeded from data/morocco_dataset.json — public,
// no ownership, no write routes.
@ApiTags('Activities')
@PublicAccess()
@Controller('/api/v1/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('/')
  async paginate(@Query() dto: PaginateActivitiesDto) {
    const { items, total, page, totalPages } = await this.activitiesService.paginate(dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, { items, total, page, totalPages });
  }

  // Declared before '/:id' — otherwise the parameterised route captures
  // "stats" as an id (Controller rule C4).
  @Get('/stats')
  async stats() {
    const stats = await this.activitiesService.statsByCity();
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, stats);
  }

  @Get('/:id')
  async findOne(@Param() { id }: SlugIdDto) {
    const activity = await this.activitiesService.findById(id);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, activity);
  }
}
