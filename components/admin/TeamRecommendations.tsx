import type { TeamRecommendation } from "@/lib/admin-queries";

export default function TeamRecommendations({
  items,
}: {
  items: TeamRecommendation[];
}) {
  return (
    <aside className="border border-outline-variant rounded-lg bg-surface-container-low p-5 h-fit">
      <h2 className="font-headline-md text-headline-md text-on-surface text-lg mb-3">
        Recomendaciones
      </h2>
      {items.length === 0 ? (
        <p className="font-body-md text-body-md text-secondary">
          El directorio está en buen estado. Mantenga al menos dos
          administradores y desactive cuentas que ya no necesiten acceso.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <p className="font-label-md text-label-md text-on-surface">
                {item.title}
              </p>
              <p className="mt-1 font-body-md text-body-md text-secondary">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
