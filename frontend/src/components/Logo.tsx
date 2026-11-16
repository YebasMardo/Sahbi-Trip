export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="block font-display text-xl font-extrabold leading-none tracking-tight">
      <span className="text-primary-500">Sahbi</span>{' '}
      <span className={dark ? 'text-white' : 'text-ink'}>Trip</span>
    </span>
  )
}
