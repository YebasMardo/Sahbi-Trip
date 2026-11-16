import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Route param for the read-only catalogue (activities, restaurants), whose
 * `_id` is the dataset's human-readable slug — see the comment above
 * `Activity` in `activities/schemas/activity.schema.ts`, not an ObjectId.
 *
 * `MongoIdDto` cannot be used for those routes: `@IsMongoId()` rejects every
 * real catalogue id, so `GET /activities/:id` answered 400 for every document
 * in the collection. Trips keep `MongoIdDto` — their ids *are* ObjectIds.
 *
 * The pattern is deliberately strict rather than a bare `@IsString()`: the
 * value is interpolated into a Mongo query, so restricting it to lowercase
 * slug characters keeps path traversal and operator-injection shapes out.
 */
export class SlugIdDto {
  @ApiProperty({ type: String, required: true, example: 'marrakech-jardin-majorelle' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Identifiant invalide.' })
  id: string;
}
