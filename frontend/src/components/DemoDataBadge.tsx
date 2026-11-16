// Marks a fabricated placeholder value (rating, userRatingCount, phone — see
// dataset `demoDataFields`) as an example, not verified data. Mirrors the
// "Illustration" credit pattern in PlaceImage.tsx: same idea (don't let a
// placeholder pass as real), separate component because it labels arbitrary
// fields/text rather than a photo.
export default function DemoDataBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Donnée d'exemple générée pour la démo — non vérifiée (en attente de l'intégration Google Places)"
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 ${className}`}
    >
      Exemple
    </span>
  )
}
