"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import PropertyImageUploader from "@/components/admin/PropertyImageUploader";
import { saveProperty } from "@/lib/actions";
import { buildCode, slugify, type PropertyInput, LOCATION_OPTIONS } from "@/lib/property-schema";
import { LOCATION_MUNICIPALITIES, municipalitiesFor } from "@/lib/location-options";

const FEATURES: { icon: string; label: string }[] = [
  { icon: "pool", label: "Piscina" },
  { icon: "smart_toy", label: "Casa inteligente" },
  { icon: "ac_unit", label: "A/C central" },
  { icon: "security", label: "Seguridad 24/7" },
  { icon: "yard", label: "Jardín" },
  { icon: "balcony", label: "Terraza" },
  { icon: "fitness_center", label: "Gimnasio" },
  { icon: "local_parking", label: "Estacionamiento" },
  { icon: "restaurant", label: "Cocina equipada" },
  { icon: "elevator", label: "Ascensor" },
  { icon: "beach_access", label: "Vistas" },
  { icon: "fireplace", label: "Chimenea" },
];

type CategoryOption = { id: string; name: string };

interface FormState extends PropertyInput {
  gallery: { url: string; alt: string }[];
}

export default function PropertyForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    id: initial?.id,
    code: initial?.code ?? "",
    title: initial?.title ?? "",
    slug: initial?.slug ?? "",
    operation: initial?.operation ?? "venta",
    status: initial?.status ?? "borrador",
    price: initial?.price ?? 0,
    currency: initial?.currency ?? "USD",
    category_id: initial?.category_id ?? null,
    location_name: initial?.location_name ?? "",
    municipality: (initial as unknown as { municipality?: string })?.municipality ?? "",
    address: initial?.address ?? "",
    bedrooms: initial?.bedrooms ?? null,
    bathrooms: initial?.bathrooms ?? null,
    parking_spaces: initial?.parking_spaces ?? null,
    land_area_m2: initial?.land_area_m2 ?? null,
    construction_area_m2: initial?.construction_area_m2 ?? null,
    description: initial?.description ?? "",
    features: initial?.features ?? [],
    main_image_url: initial?.main_image_url ?? "",
    gallery: initial?.gallery ?? [],
    is_featured: initial?.is_featured ?? false,
    map_image_url: initial?.map_image_url ?? "",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isEdit = Boolean(initial?.id);
  const mainImage = form.main_image_url
    ? [{ url: form.main_image_url, alt: "" }]
    : [];

  function onTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: f.slug || slugify(title),
      code: f.code || buildCode(title),
    }));
  }

  function toggleFeature(icon: string, label: string) {
    setForm((f) => {
      const exists = f.features.some((feat) => feat.icon === icon);
      return {
        ...f,
        features: exists
          ? f.features.filter((feat) => feat.icon !== icon)
          : [...f.features, { icon, label }],
      };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveProperty(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/propiedades");
      router.refresh();
    });
  }

  const inputCls =
    "bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary w-full";
  const labelCls = "font-label-sm text-label-sm text-secondary mb-1 flex flex-col gap-1";

  return (
    <form
      onSubmit={submit}
      className="max-w-4xl flex flex-col gap-6"
    >
      {error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}

      {/* Datos generales */}
      <fieldset className="bg-surface-container-low rounded-lg border border-outline-variant p-6">
        <legend className="font-headline-md text-headline-md text-on-surface px-2">
          Datos generales
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={labelCls}>
            Título *
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => onTitleChange(e.target.value)}
              className={inputCls}
              placeholder="Ej: Villa moderna en Escazú"
            />
          </label>
          <label className={labelCls}>
            Código
            <input
              type="text"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              className={inputCls}
              placeholder="Auto (GAV-…) si se deja vacío"
            />
          </label>
          <label className={labelCls}>
            Slug
            <input
              type="text"
              value={form.slug}
              onChange={(e) => set("slug", slugify(e.target.value))}
              className={inputCls}
              placeholder="auto-generado desde el título"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className={labelCls}>
              Operación
              <select
                value={form.operation}
                onChange={(e) => set("operation", e.target.value as "venta" | "alquiler")}
                className={inputCls}
              >
                <option value="venta">Venta</option>
                <option value="alquiler">Alquiler</option>
              </select>
            </label>
            <label className={labelCls}>
              Estado
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as FormState["status"])}
                className={inputCls}
              >
                <option value="borrador">Borrador</option>
                <option value="publicada">Publicada</option>
                <option value="vendida">Vendida</option>
                <option value="archivada">Archivada</option>
              </select>
            </label>
          </div>
        </div>
        <label className={`${labelCls} mt-4 inline-flex items-center gap-2 cursor-pointer flex-row`}>
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => set("is_featured", e.target.checked)}
            className="accent-[var(--color-primary)] w-4 h-4"
          />
          <span>Destacada (aparece en la portada, máximo 6)</span>
        </label>
      </fieldset>

      {/* Precio */}
      <fieldset className="bg-surface-container-low rounded-lg border border-outline-variant p-6">
        <legend className="font-headline-md text-headline-md text-on-surface px-2">
          Precio
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className={labelCls}>
            Precio * (número)
            <input
              type="number"
              required
              min={0}
              value={form.price || ""}
              onChange={(e) => set("price", Number(e.target.value))}
              className={inputCls}
              placeholder="250000"
            />
          </label>
          <label className={labelCls}>
            Moneda
            <select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              className={inputCls}
            >
              <option value="USD">USD $</option>
              <option value="HNL">HNL L</option>
            </select>
          </label>
          <label className={labelCls}>
            Dirección
            <input
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className={inputCls}
              placeholder="123 Calle Principal"
            />
          </label>
        </div>
      </fieldset>

      {/* Clasificación y medidas */}
      <fieldset className="bg-surface-container-low rounded-lg border border-outline-variant p-6">
        <legend className="font-headline-md text-headline-md text-on-surface px-2">
          Clasificación y medidas
        </legend>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <label className={labelCls}>
            Categoría
            <select
              value={form.category_id ?? ""}
              onChange={(e) => set("category_id", e.target.value || null)}
              className={inputCls}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Ubicación (departamento)
            <select
              required
              value={form.location_name}
              onChange={(e) => {
                const dept = e.target.value;
                setForm((f) => {
                  const validMunis = municipalitiesFor(dept);
                  const keepMuni = validMunis.includes(f.municipality) ? f.municipality : "";
                  return { ...f, location_name: dept, municipality: keepMuni };
                });
              }}
              className={inputCls}
            >
              <option value="">Seleccione departamento</option>
              {form.location_name && !(LOCATION_OPTIONS as readonly string[]).includes(form.location_name) && (
                <option value={form.location_name}>
                  {form.location_name} (Ubicación actual)
                </option>
              )}
              {LOCATION_OPTIONS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            Municipio
            <select
              value={form.municipality}
              onChange={(e) => set("municipality", e.target.value)}
              className={inputCls}
            >
              <option value="">Seleccione municipio (opcional)</option>
              {form.location_name && municipalitiesFor(form.location_name).length > 0
                ? municipalitiesFor(form.location_name).map((m) => (
                    <option key={`${form.location_name}-${m}`} value={m}>
                      {m}
                    </option>
                  ))
                : // sin departamento, mostrar todos ordenados (deduplicados)
                  ([...new Set(Object.values(LOCATION_MUNICIPALITIES).flat())].sort((a, b) => a.localeCompare(b, "es")) as string[]).slice(0, 80).map((m, idx) => (
                    <option key={`${m}-${idx}`} value={m}>
                      {m}
                    </option>
                  ))}
              {form.municipality && ! municipalitiesFor(form.location_name).includes(form.municipality) && ! Object.values(LOCATION_MUNICIPALITIES).flat().includes(form.municipality) && (
                <option value={form.municipality}>{form.municipality} (actual)</option>
              )}
            </select>
          </label>
          <label className={labelCls}>
            Habitaciones
            <input
              type="number"
              min={0}
              value={form.bedrooms ?? ""}
              onChange={(e) => set("bedrooms", e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Baños
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.bathrooms ?? ""}
              onChange={(e) => set("bathrooms", e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Parqueos
            <input
              type="number"
              min={0}
              value={form.parking_spaces ?? ""}
              onChange={(e) => set("parking_spaces", e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Área de construcción (m²)
            <input
              type="number"
              min={0}
              value={form.construction_area_m2 ?? ""}
              onChange={(e) => set("construction_area_m2", e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Área del terreno (m²)
            <input
              type="number"
              min={0}
              value={form.land_area_m2 ?? ""}
              onChange={(e) => set("land_area_m2", e.target.value ? Number(e.target.value) : null)}
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      {/* Descripción */}
      <fieldset className="bg-surface-container-low rounded-lg border border-outline-variant p-6">
        <legend className="font-headline-md text-headline-md text-on-surface px-2">
          Descripción
        </legend>
        <label className={labelCls}>
          Descripción de la propiedad
          <textarea
            rows={6}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${inputCls} resize-y`}
            placeholder="Describe la propiedad… Separa los párrafos con una línea en blanco."
          />
        </label>
        <p className="font-label-sm text-label-sm text-secondary mt-2 mb-2">
          Características y amenidades
        </p>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((feat) => {
            const active = form.features.some((f) => f.icon === feat.icon);
            return (
              <button
                key={feat.icon}
                type="button"
                onClick={() => toggleFeature(feat.icon, feat.label)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 font-label-sm text-label-sm px-3 py-1.5 rounded border transition-colors ${
                  active
                    ? "bg-primary-container text-on-primary-container border-primary"
                    : "bg-surface text-secondary border-outline-variant hover:border-primary"
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {feat.icon}
                </span>
                {feat.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Imágenes */}
      <fieldset className="bg-surface-container-low rounded-lg border border-outline-variant p-6">
        <legend className="font-headline-md text-headline-md text-on-surface px-2">
          Imágenes
        </legend>
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-label-sm text-label-sm text-secondary mb-2">
              Imagen principal
            </p>
            <PropertyImageUploader
              value={mainImage}
              onChange={(next) => set("main_image_url", next[0]?.url ?? "")}
              folder={form.slug}
              emptyHint="Recorte 16:9 y subida a Storage, o pegue una URL. Es la foto de portada, catálogo y listado."
            />
          </div>

          <div>
            <p className="font-label-sm text-label-sm text-secondary mb-2">
              Galería (opcional)
            </p>
            <PropertyImageUploader
              value={form.gallery}
              onChange={(next) => set("gallery", next)}
              folder={form.slug}
              multiple
              withAltText
              emptyHint="Se muestran en la página de detalle, en el orden de esta lista. También puede pegar URLs."
            />
          </div>

          <label className={labelCls}>
            Imagen del mapa (opcional)
            <input
              type="url"
              value={form.map_image_url}
              onChange={(e) => set("map_image_url", e.target.value)}
              className={inputCls}
              placeholder="Enlace de Google Maps (Compartir → copiar) o URL de imagen"
            />
            <span className="font-body-sm text-body-sm text-secondary font-normal">
              Pegue un enlace de Google Maps y se mostrará un mapa incrustado;
              también acepta una URL de imagen directa.
            </span>
          </label>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 pb-8">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors disabled:opacity-60"
        >
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear propiedad"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="font-label-md text-label-md text-secondary px-6 py-3 rounded hover:bg-surface-container-high transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
