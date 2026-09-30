export default function SiteLoading() {
  return (
    <div
      className="pt-28 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop site-loading-enter"
      role="status"
      aria-live="polite"
      aria-label="Cargando página"
      aria-busy="true"
    >
      {/* Marca sutil */}
      <div className="flex items-center gap-3 mb-8">
        <span className="site-loading-mark" aria-hidden="true" />
        <span className="font-headline-md text-headline-md text-secondary/70 tracking-wide text-sm uppercase">
          Cargando
        </span>
        <span className="h-px flex-1 bg-outline-variant/40 ml-2 hidden sm:block" aria-hidden="true" />
      </div>

      {/* Encabezado premium — shimmer */}
      <div className="mb-stack-lg max-w-3xl">
        <div className="skeleton-shimmer h-8 w-[min(420px,72%)] rounded-lg mb-3" />
        <div className="skeleton-shimmer h-4 w-[min(560px,92%)] rounded-full opacity-80" />
        <div className="skeleton-shimmer h-4 w-[min(420px,68%)] rounded-full mt-2 opacity-60" />
      </div>

      {/* Barra de búsqueda / filtros skeleton */}
      <div className="skeleton-card rounded-xl border border-outline-variant/50 p-4 mb-stack-lg flex flex-col sm:flex-row gap-3">
        <div className="skeleton-shimmer h-12 flex-1 rounded-lg" />
        <div className="skeleton-shimmer h-12 flex-1 rounded-lg hidden sm:block" />
        <div className="skeleton-shimmer h-12 w-full sm:w-32 rounded-lg" />
      </div>

      {/* Grid premium */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-gutter">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-card bg-surface-container-lowest rounded-xl border border-outline-variant/60 overflow-hidden"
            style={{ animationDelay: `${i * 70}ms` } as React.CSSProperties}
          >
            <div className="skeleton-shimmer aspect-[16/10] w-full" />
            <div className="p-4 space-y-3">
              <div className="skeleton-shimmer h-5 w-3/4 rounded-full" />
              <div className="skeleton-shimmer h-3.5 w-1/2 rounded-full opacity-70" />
              <div className="flex gap-2 pt-2">
                <span className="skeleton-shimmer h-6 w-16 rounded-full opacity-60" />
                <span className="skeleton-shimmer h-6 w-16 rounded-full opacity-60" />
                <span className="skeleton-shimmer h-6 w-16 rounded-full opacity-60 hidden sm:inline-block" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Cargando contenido, por favor espere…</span>
    </div>
  );
}
