import { QueryFilter, Model, SortOrder } from 'mongoose';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

// TDoc is the hydrated document type (e.g. ActivityDocument) — kept
// separate from Mongoose's own schema generic because Model<T>.find()
// already returns hydrated documents, and forcing T to double as both
// the schema class and the return type fights the mongoose 9 typings.
export async function paginateQuery<TDoc>(
  model: Model<any>,
  filterQuery: QueryFilter<any>,
  { page, limit, sort }: { page: number; limit: number; sort: Record<string, SortOrder> },
  populate?: any,
): Promise<PaginatedResult<TDoc>> {
  const skip = (page - 1) * limit;
  const query = model.find(filterQuery).sort(sort).skip(skip).limit(limit);
  if (populate) query.populate(populate);

  const [items, total] = await Promise.all([
    query.exec() as unknown as Promise<TDoc[]>,
    model.countDocuments(filterQuery).exec(),
  ]);
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}
