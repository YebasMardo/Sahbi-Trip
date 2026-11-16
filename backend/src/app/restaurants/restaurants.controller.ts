import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicAccess } from 'src/app/auth/decorators/public-access.decorator';
import { SlugIdDto } from 'src/core/dtos/slugId.dto';
import { SuccessResponse, SuccessResponseEnum } from 'src/core/httpResponse/SuccessResponse';
import { RestaurantsService } from './restaurants.service';
import { PaginateRestaurantsDto } from './dto/paginate-restaurants.dto';

@ApiTags('Restaurants')
@PublicAccess()
@Controller('/api/v1/restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get('/')
  async paginate(@Query() dto: PaginateRestaurantsDto) {
    const { items, total, page, totalPages } = await this.restaurantsService.paginate(dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, { items, total, page, totalPages });
  }

  // Declared before '/:id' — see the same note in activities.controller.ts.
  @Get('/stats')
  async stats() {
    const stats = await this.restaurantsService.statsByCity();
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, stats);
  }

  @Get('/:id')
  async findOne(@Param() { id }: SlugIdDto) {
    const restaurant = await this.restaurantsService.findById(id);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, restaurant);
  }
}
