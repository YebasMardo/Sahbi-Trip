import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { paginateQuery, PaginatedResult } from 'src/core/utils/paginate.util';
import { Restaurant, RestaurantDocument } from './schemas/restaurant.schema';
import { PaginateRestaurantsDto } from './dto/paginate-restaurants.dto';
import restaurantsStrings from './restaurants.strings';

export interface RestaurantStats {
  byCity: Array<{ city: string; total: number }>;
  total: number;
}

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<Restaurant>,
  ) {}

  async paginate(dto: PaginateRestaurantsDto): Promise<PaginatedResult<RestaurantDocument>> {
    const { page, limit, sort, city, cuisine, priceLevel, query } = dto;

    const filterQuery: QueryFilter<Restaurant> = { $and: [] };
    if (city) filterQuery.$and!.push({ city });
    if (priceLevel) filterQuery.$and!.push({ priceLevel });
    if (cuisine) {
      filterQuery.$and!.push({ cuisine: new RegExp(cuisine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    }
    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filterQuery.$and!.push({ $or: [{ name: regex }, { description: regex }, { tags: regex }] });
    }
    if (!filterQuery.$and!.length) delete filterQuery.$and;

    return paginateQuery<RestaurantDocument>(this.restaurantModel, filterQuery, { page, limit, sort });
  }

  async findById(id: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel.findById(id).exec();
    if (!restaurant) {
      throw new NotFoundException(restaurantsStrings.E_RESTAURANT_NOT_FOUND);
    }
    return restaurant;
  }

  findManyByIds(ids: string[]): Promise<RestaurantDocument[]> {
    return this.restaurantModel.find({ _id: { $in: ids } }).exec();
  }

  // Catalogue coverage per city, for the public landing page.
  async statsByCity(): Promise<RestaurantStats> {
    const rows = await this.restaurantModel
      .aggregate<{ _id: string; total: number }>([
        { $group: { _id: '$city', total: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .exec();

    const byCity = rows.map((r) => ({ city: r._id, total: r.total }));
    return { byCity, total: byCity.reduce((s, c) => s + c.total, 0) };
  }

  aggregateRaw(pipeline: Record<string, unknown>[]) {
    return this.restaurantModel.aggregate(pipeline as any);
  }
}
