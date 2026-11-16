import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MongoIdDto } from './mongoId.dto';
import { SlugIdDto } from './slugId.dto';

// Regression guard for a real integration bug: both catalogue controllers
// validated their `:id` param with MongoIdDto, but Activity/Restaurant `_id`
// is the dataset's slug — so GET /activities/:id answered 400 for every
// document in the collection, and the activity detail page could never load.

const invalid = (dto: object) => validateSync(dto).length > 0;
const parseSlug = (id: string) => plainToInstance(SlugIdDto, { id });

describe('SlugIdDto', () => {
  it('accepts every id in the shipped dataset', () => {
    const dataset = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', '..', 'data', 'morocco_dataset.json'), 'utf-8'),
    ) as { activities: { id: string }[]; restaurants: { id: string }[] };
    const ids = [...dataset.activities, ...dataset.restaurants].map((row) => row.id);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => invalid(parseSlug(id)))).toEqual([]);
  });

  it.each([
    ['operator injection', '{"$ne":null}'],
    ['path traversal', '../../etc/passwd'],
    ['uppercase', 'Marrakech-Majorelle'],
    ['underscore', 'marrakech_majorelle'],
    ['whitespace', 'marrakech majorelle'],
    ['leading hyphen', '-marrakech'],
    ['trailing hyphen', 'marrakech-'],
    ['double hyphen', 'marrakech--majorelle'],
    ['empty', ''],
  ])('rejects %s', (_label, id) => {
    expect(invalid(parseSlug(id))).toBe(true);
  });

  it('is the inverse of MongoIdDto — neither accepts the other\'s ids', () => {
    const slug = 'marrakech-jardin-majorelle';
    const objectId = '6ab848d14cc83e9480c52552';

    // The bug in one line: a real catalogue id fails MongoId validation.
    expect(invalid(plainToInstance(MongoIdDto, { id: slug }))).toBe(true);
    expect(invalid(parseSlug(slug))).toBe(false);

    // Trips keep MongoIdDto — their ids really are ObjectIds.
    expect(invalid(plainToInstance(MongoIdDto, { id: objectId }))).toBe(false);
    // Note the slug pattern is a superset: an ObjectId is lowercase hex, so it
    // passes too. Harmless — the catalogue lookup simply 404s. The pattern is
    // here to bound the character set, not to distinguish the two id kinds.
    expect(invalid(parseSlug(objectId))).toBe(false);
  });
});
