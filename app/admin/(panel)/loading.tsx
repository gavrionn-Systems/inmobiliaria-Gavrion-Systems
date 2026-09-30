export default function AdminLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Cargando">
      <div className="h-8 w-56 bg-surface-container-high rounded animate-pulse" />
      <div className="h-14 w-full max-w-md bg-surface-container rounded animate-pulse" />
      <div className="border border-outline-variant rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4 border-b border-outline-variant/60 last:border-b-0 bg-surface-container-low"
          >
            <div className="w-16 h-12 bg-surface-container-high rounded animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-surface-container-high rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-surface-container rounded animate-pulse" />
            </div>
            <div className="hidden sm:block h-6 w-20 bg-surface-container-high rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
