import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { paginateQuery, PaginatedResult } from 'src/core/utils/paginate.util';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import { PaginateActivitiesDto } from './dto/paginate-activities.dto';
import activitiesStrings from './activities.strings';

export interface CatalogueStats {
  byCity: Array<{ city: string; total: number; free: number }>;
  total: number;
  free: number;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private readonly activityModel: Model<Activity>,
  ) {}

  async paginate(dto: PaginateActivitiesDto): Promise<PaginatedResult<ActivityDocument>> {
    const { page, limit, sort, city, category, isFree, touristLevel, maxPrice, query } = dto;

    const filterQuery: QueryFilter<Activity> = { $and: [] };
    if (city) filterQuery.$and!.push({ city });
    if (category) filterQuery.$and!.push({ category });
    if (isFree !== undefined) filterQuery.$and!.push({ isFree });
    if (touristLevel) filterQuery.$and!.push({ touristLevel });
    if (maxPrice !== undefined) {
      filterQuery.$and!.push({
        $or: [{ isFree: true }, { price: { $lte: maxPrice } }, { price: null }],
      });
    }
    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      filterQuery.$and!.push({ $or: [{ name: regex }, { description: regex }, { tags: regex }] });
    }
    if (!filterQuery.$and!.length) delete filterQuery.$and;

    return paginateQuery<ActivityDocument>(this.activityModel, filterQuery, { page, limit, sort });
  }

  async findById(id: string): Promise<ActivityDocument> {
    const activity = await this.activityModel.findById(id).exec();
    if (!activity) {
      throw new NotFoundException(activitiesStrings.E_ACTIVITY_NOT_FOUND);
    }
    return activity;
  }

  // Used by the AI tools/retrieval layer — internal, no 404 semantics.
  findManyByIds(ids: string[]): Promise<ActivityDocument[]> {
    return this.activityModel.find({ _id: { $in: ids } }).exec();
  }

  // Catalogue coverage per city, for the public landing page. One grouped
  // query rather than a count request per city.
  async statsByCity(): Promise<CatalogueStats> {
    const rows = await this.activityModel
      .aggregate<{ _id: string; total: number; free: number }>([
        {
          $group: {
            _id: '$city',
            total: { $sum: 1 },
            free: { $sum: { $cond: [{ $eq: ['$isFree', true] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();

    const byCity = rows.map((r) => ({ city: r._id, total: r.total, free: r.free }));
    return {
      byCity,
      total: byCity.reduce((s, c) => s + c.total, 0),
      free: byCity.reduce((s, c) => s + c.free, 0),
    };
  }

  // Native aggregation access for $vectorSearch — Mongoose forwards
  // arbitrary pipeline stages straight to the driver. Typed loosely
  // because $vectorSearch/$project stages built dynamically don't match
  // Mongoose's exact PipelineStage union member-by-member.
  aggregateRaw(pipeline: Record<string, unknown>[]) {
    return this.activityModel.aggregate(pipeline as any);
  }
}
