/**
 * Editorial copy for the public landing page's destination cards.
 *
 * Only the human-written parts live here — tagline, description, cover photo.
 * The counts shown next to each city (activities, free activities,
 * restaurants) come from `GET /activities/stats` and `GET /restaurants/stats`
 * so they stay true as the catalogue grows; see LandingPage.
 */
export interface DestinationCopy {
  city: string
  tagline: string
  description: string
  image: { url: string; credit: string; license: string }
}

export const destinations: DestinationCopy[] = [
  {
    city: 'Marrakech',
    tagline: 'La ville rouge',
    description: 'Médina animée, jardins secrets et palais saadiens — culture, souks et gastronomie.',
    image: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Koutbia.jpg?width=800',
      credit: 'joaomaximo',
      license: 'CC BY 2.0',
    },
  },
  {
    city: 'Casablanca',
    tagline: 'La métropole atlantique',
    description: 'La plus grande ville du Maroc : mosquée Hassan II, corniche et art déco.',
    image: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Boulevard_de_la_Corniche%2C_Dar-el-Beida%2C_Morocco_-_panoramio_(13).jpg?width=800',
      credit: "Patrick Nouhailler's…",
      license: 'CC BY-SA 3.0',
    },
  },
  {
    city: 'Rabat',
    tagline: 'La capitale royale',
    description: 'Kasbah des Oudayas, Tour Hassan et Chellah — histoire et bord de mer.',
    image: {
      url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Kasbah_Oudayas_exterior.jpg?width=800',
      credit: 'Davide Cesare Veniani',
      license: 'CC BY-SA 3.0',
    },
  },
]
