import { MapPin } from 'lucide-react'

const PIN_POSITIONS = [
  { left: '28%', top: '62%' },
  { left: '62%', top: '28%' },
  { left: '78%', top: '68%' },
]

export default function RouteMapCard({ cities }: { cities: string[] }) {
  const pins = cities.slice(0, 3)

  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-gradient-to-br from-[#eaf4f0] to-[#dcecf4]">
      <svg viewBox="0 0 320 176" className="absolute inset-0 size-full" aria-hidden>
        <path
          d="M0 40 C 60 10, 100 60, 160 30 S 260 0, 320 50 L320 176 L0 176 Z"
          fill="#dff0e6"
          opacity={0.7}
        />
        <path
          d="M210 30 C 190 70, 230 90, 210 130"
          fill="none"
          stroke="#b9d6c6"
          strokeWidth={3}
        />
        {pins.length > 1 && (
          <path
            d="M100 120 C 130 80, 150 60, 200 55"
            fill="none"
            stroke="var(--color-primary-500)"
            strokeWidth={2.5}
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        )}
      </svg>

      {pins.map((city, i) => (
        <div
          key={city}
          className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
          style={PIN_POSITIONS[i]}
        >
          <span className="grid size-6 place-items-center rounded-full bg-primary-500 text-white shadow-card">
            <MapPin size={13} fill="white" />
          </span>
          <span className="mt-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-card">
            {city}
          </span>
        </div>
      ))}
    </div>
  )
}
