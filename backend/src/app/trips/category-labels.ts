// Display labels for ActivityPicker/timeline chips — mirrors the French
// wording already used by the frontend mock (frontend/src/data/trips.ts
// categoryLabel field). Covers ACTIVITY_CATEGORIES plus the two categories
// that have no catalogue enum of their own (restaurants, transport legs).
export const CATEGORY_LABELS: Record<string, string> = {
  nature: 'Nature',
  culture: 'Culture',
  histoire: 'Histoire',
  plage: 'Plage',
  shopping: 'Shopping',
  medina: 'Médina',
  parc: 'Parc',
  zoo: 'Zoo',
  'parc-attractions': "Parc d'attractions",
  place: 'Place',
  promenade: 'Balade',
  gastronomie: 'Gastronomie',
  transport: 'Transport',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
