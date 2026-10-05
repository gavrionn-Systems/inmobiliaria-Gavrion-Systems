"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  saveSiteSettings,
  type SiteSettingsInput,
} from "@/lib/site-settings-actions";
import { deletePropertyImage, uploadPropertyImage } from "@/lib/upload-actions";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const fieldClass =
  "bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary w-full";

const editorSections = [
  { id: "identity", label: "Identidad" },
  { id: "contact", label: "Contacto" },
  { id: "location", label: "Ubicación" },
  { id: "social", label: "Redes" },
  { id: "hero", label: "Portada" },
  { id: "content", label: "Contenido" },
  { id: "admin", label: "Administración" },
  { id: "theme", label: "Colores" },
  { id: "about", label: "Nosotros" },
  { id: "agent", label: "Agente" },
  { id: "search", label: "Buscador" },
  { id: "performance", label: "Rendimiento" },
  { id: "cache", label: "Caché" },
  { id: "experience", label: "Búsqueda" },
  { id: "indexing", label: "Indexación" },
] as const;

const adminMenuOptions = [
  { key: "crm", label: "CRM", description: "Contactos, inbox, pipeline, calendario y tareas." },
  { key: "propiedades", label: "Propiedades", description: "Catálogo, creación y edición de propiedades." },
  { key: "solicitudes", label: "Solicitudes", description: "Solicitudes recibidas desde el sitio público." },
  { key: "equipo", label: "Equipo", description: "Usuarios y agentes de la inmobiliaria." },
  { key: "categorias", label: "Categorías", description: "Tipos y categorías del catálogo." },
  { key: "configuracion", label: "Configuración", description: "Configuración del sitio y del panel administrativo." },
] as const;

type AdminMenuKey = (typeof adminMenuOptions)[number]["key"];

type EditorSectionId = (typeof editorSections)[number]["id"];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-label-sm text-label-sm text-secondary">{label}</span>
      {children}
      {hint ? (
        <span className="font-label-sm text-label-sm text-secondary">{hint}</span>
      ) : null}
    </label>
  );
}

export default function SiteSettingsForm({
  initial,
}: {
  initial: SiteSettingsInput;
}) {
  const router = useRouter();
  const heroInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<EditorSectionId>("identity");

  function set<K extends keyof SiteSettingsInput>(
    key: K,
    value: SiteSettingsInput[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setStat(index: number, key: "value" | "label", value: string) {
    setValues((current) => ({
      ...current,
      aboutStats: current.aboutStats.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function setSiteValue(
    index: number,
    key: "icon" | "title" | "description",
    value: string
  ) {
    setValues((current) => ({
      ...current,
      aboutValues: current.aboutValues.map((row, i) =>
        i === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function setAdminMenuVisibility(key: AdminMenuKey, visible: boolean) {
    setValues((current) => ({
      ...current,
      adminMenuVisibility: {
        ...current.adminMenuVisibility,
        [key]: visible,
      },
    }));
  }

  async function onHeroFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
      setError("Formato no admitido. Use JPG, PNG o WebP.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("La imagen supera el límite de 5 MB.");
      return;
    }

    setUploadingHero(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "site-hero");

    const result = await uploadPropertyImage(formData);
    setUploadingHero(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const previousUrl = values.heroImageUrl;
    set("heroImageUrl", result.url);

    if (previousUrl && previousUrl !== result.url) {
      await deletePropertyImage(previousUrl);
    }
  }

  async function onLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
      setError("Formato no admitido. Use JPG, PNG o WebP.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("La imagen supera el límite de 5 MB.");
      return;
    }

    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "site-logo");

    const result = await uploadPropertyImage(formData);
    setUploadingLogo(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const previousUrl = values.logoUrl;
    set("logoUrl", result.url);

    if (previousUrl && previousUrl !== result.url) {
      await deletePropertyImage(previousUrl);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await saveSiteSettings(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        "Configuración guardada. Los cambios ya se reflejan en el sitio público."
      );
      router.refresh();
    } catch {
      setError("No se pudo guardar. Intente de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-5xl flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          aria-live="polite"
          className="bg-primary-container text-on-primary-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {success}
        </p>
      ) : null}

      <p className="font-body-md text-body-md text-secondary bg-surface-container-low border border-outline-variant rounded-lg px-4 py-3">
        Términos y privacidad (páginas /terminos y /privacidad) son texto base.
        Un abogado o el cliente deben confirmarlos antes del lanzamiento.
      </p>

      <nav
        aria-label="Secciones de configuración"
        className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-low p-1 shadow-sm"
      >
        <div role="tablist" className="flex min-w-max gap-1">
          {editorSections.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              aria-controls={`site-settings-${section.id}`}
              onClick={() => setActiveSection(section.id)}
              className={`rounded-md px-4 py-2.5 font-label-md text-label-md whitespace-nowrap transition-colors ${
                activeSection === section.id
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-secondary hover:bg-surface hover:text-on-surface"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      <section id="site-settings-identity" role="tabpanel" hidden={activeSection !== "identity"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Identidad
        </h2>
        <Field label="Nombre de la inmobiliaria">
          <input
            type="text"
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field
          label="URL del sitio"
          hint="Se usa en metadatos y enlaces canónicos."
        >
          <input
            type="url"
            required
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field
          label="Logo"
          hint="Suba un archivo (JPG, PNG o WebP, máx. 5 MB) que se guarda en Supabase, o pegue una URL https. Se muestra en el encabezado público y en el panel."
        >
          <div className="flex flex-col gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={onLogoFileSelected}
            />
            <button
              type="button"
              disabled={uploadingLogo || pending}
              onClick={() => logoInputRef.current?.click()}
              className="self-start inline-flex items-center gap-2 bg-surface border border-outline-variant rounded px-4 py-2.5 font-label-md text-label-md text-on-surface hover:border-primary hover:text-primary transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                upload
              </span>
              {uploadingLogo ? "Subiendo…" : "Elegir archivo"}
            </button>
            <input
              type="url"
              required
              value={values.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              className={fieldClass}
              placeholder="https://…"
              aria-label="URL del logo"
            />
          </div>
        </Field>
        {values.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={values.logoUrl}
            alt="Vista previa del logo"
            className="h-16 w-16 object-contain bg-surface rounded border border-outline-variant p-1"
          />
        ) : null}
      </section>

      <section id="site-settings-contact" role="tabpanel" hidden={activeSection !== "contact"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Contacto
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Teléfono">
            <input
              type="tel"
              required
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              required
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
        <Field label="Dirección (línea 1)">
          <input
            type="text"
            value={values.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Dirección (línea 2)">
          <input
            type="text"
            value={values.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field
          label="WhatsApp"
          hint="Número (ej. +504 9961-5803) o enlace https://wa.me/..."
        >
          <input
            type="text"
            value={values.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Horario de atención">
          <textarea
            rows={3}
            value={values.hours}
            onChange={(e) => set("hours", e.target.value)}
            className={`${fieldClass} min-h-24 resize-y`}
          />
        </Field>
      </section>

      <section id="site-settings-location" role="tabpanel" hidden={activeSection !== "location"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">location_on</span>
          Ubicación
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Estos datos se muestran en Contacto, el pie de página y los datos estructurados del sitio.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Ciudad o municipio">
            <input value={values.city} onChange={(e) => set("city", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="País">
            <input value={values.country} onChange={(e) => set("country", e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <Field label="Enlace de Google Maps" hint="Pegue el enlace de la ubicación de la oficina. Se abrirá al hacer clic en la dirección.">
          <input type="url" value={values.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} className={fieldClass} placeholder="https://maps.google.com/..." />
        </Field>
      </section>

      <section id="site-settings-social" role="tabpanel" hidden={activeSection !== "social"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Redes sociales
        </h2>
        <Field label="Facebook">
          <input
            type="text"
            value={values.facebook}
            onChange={(e) => set("facebook", e.target.value)}
            placeholder="https://facebook.com/..."
            className={fieldClass}
          />
        </Field>
        <Field label="Instagram">
          <input
            type="text"
            value={values.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="https://instagram.com/..."
            className={fieldClass}
          />
        </Field>
      </section>

      <section id="site-settings-hero" role="tabpanel" hidden={activeSection !== "hero"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Portada (inicio)
        </h2>
        <Field
          label="Foto de portada"
          hint="Horizontal, buena resolución. Se guarda en Supabase (JPG, PNG o WebP, máx. 5 MB)."
        >
          <div className="flex flex-col gap-3">
            <input
              ref={heroInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={onHeroFileSelected}
            />
            <button
              type="button"
              disabled={uploadingHero || pending}
              onClick={() => heroInputRef.current?.click()}
              className="self-start inline-flex items-center gap-2 bg-surface border border-outline-variant rounded px-4 py-2.5 font-label-md text-label-md text-on-surface hover:border-primary hover:text-primary transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-lg">
                upload
              </span>
              {uploadingHero ? "Subiendo…" : "Elegir archivo"}
            </button>
            <input
              type="url"
              required
              value={values.heroImageUrl}
              onChange={(e) => set("heroImageUrl", e.target.value)}
              className={fieldClass}
              placeholder="https://…"
              aria-label="URL de la foto de portada"
            />
          </div>
        </Field>
        {values.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={values.heroImageUrl}
            alt="Vista previa de la portada"
            className="h-28 w-full max-w-md object-cover bg-surface rounded border border-outline-variant"
          />
        ) : null}
        <Field label="Título del hero">
          <input
            type="text"
            required
            value={values.heroTitle}
            onChange={(e) => set("heroTitle", e.target.value)}
            className={fieldClass}
          />
        </Field>
        <Field label="Subtítulo del hero">
          <textarea
            rows={3}
            value={values.heroSubtitle}
            onChange={(e) => set("heroSubtitle", e.target.value)}
            className={`${fieldClass} min-h-24 resize-y`}
          />
        </Field>
      </section>

      <section id="site-settings-content" role="tabpanel" hidden={activeSection !== "content"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Contenido del sitio
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Personalice los textos públicos de las páginas principales sin modificar código.
        </p>
        <h3 className="font-headline-md text-headline-md text-on-surface mt-2">Inicio</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Etiqueta del hero"><input value={values.homeEyebrow} onChange={(e) => set("homeEyebrow", e.target.value)} className={fieldClass} /></Field>
          <Field label="Botón del catálogo"><input value={values.homeCatalogButton} onChange={(e) => set("homeCatalogButton", e.target.value)} className={fieldClass} /></Field>
          <Field label="Botón de contacto"><input value={values.homeContactButton} onChange={(e) => set("homeContactButton", e.target.value)} className={fieldClass} /></Field>
          <Field label="Título de destacadas"><input value={values.homeFeaturedTitle} onChange={(e) => set("homeFeaturedTitle", e.target.value)} className={fieldClass} /></Field>
        </div>
        <Field label="Descripción de destacadas"><textarea rows={2} value={values.homeFeaturedSubtitle} onChange={(e) => set("homeFeaturedSubtitle", e.target.value)} className={`${fieldClass} resize-y`} /></Field>
        <Field label="Mensaje sin destacadas"><input value={values.homeEmptyFeatured} onChange={(e) => set("homeEmptyFeatured", e.target.value)} className={fieldClass} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Título del llamado a la acción"><input value={values.homeCtaTitle} onChange={(e) => set("homeCtaTitle", e.target.value)} className={fieldClass} /></Field>
          <Field label="Botón del llamado a la acción"><input value={values.homeCtaButton} onChange={(e) => set("homeCtaButton", e.target.value)} className={fieldClass} /></Field>
        </div>
        <Field label="Texto del llamado a la acción"><textarea rows={3} value={values.homeCtaText} onChange={(e) => set("homeCtaText", e.target.value)} className={`${fieldClass} resize-y`} /></Field>

        <h3 className="font-headline-md text-headline-md text-on-surface mt-2">Propiedades</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Título del catálogo"><input value={values.catalogTitle} onChange={(e) => set("catalogTitle", e.target.value)} className={fieldClass} /></Field>
          <Field label="Mensaje sin resultados"><input value={values.catalogEmpty} onChange={(e) => set("catalogEmpty", e.target.value)} className={fieldClass} /></Field>
        </div>
        <Field label="Descripción del catálogo"><textarea rows={2} value={values.catalogSubtitle} onChange={(e) => set("catalogSubtitle", e.target.value)} className={`${fieldClass} resize-y`} /></Field>

        <h3 className="font-headline-md text-headline-md text-on-surface mt-2">Nosotros y contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Etiqueta de Nosotros"><input value={values.aboutEyebrow} onChange={(e) => set("aboutEyebrow", e.target.value)} className={fieldClass} /></Field>
          <Field label="Título de Nosotros"><input value={values.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} className={fieldClass} /></Field>
          <Field label="Título de misión"><input value={values.aboutMissionTitle} onChange={(e) => set("aboutMissionTitle", e.target.value)} className={fieldClass} /></Field>
          <Field label="Título de valores"><input value={values.aboutValuesTitle} onChange={(e) => set("aboutValuesTitle", e.target.value)} className={fieldClass} /></Field>
          <Field label="Etiqueta de contacto"><input value={values.contactEyebrow} onChange={(e) => set("contactEyebrow", e.target.value)} className={fieldClass} /></Field>
          <Field label="Título de contacto"><input value={values.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} className={fieldClass} /></Field>
        </div>
        <Field label="Subtítulo de contacto"><textarea rows={3} value={values.contactSubtitle} onChange={(e) => set("contactSubtitle", e.target.value)} className={`${fieldClass} resize-y`} /></Field>
      </section>

      <section id="site-settings-admin" role="tabpanel" hidden={activeSection !== "admin"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">admin_panel_settings</span>
          Editar vista administrativa
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Personalice los textos que verá el administrador de la empresa. El nombre,
          logo e identidad visual se comparten automáticamente con el sitio público.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Título del inicio administrativo">
            <input value={values.adminWelcomeTitle} onChange={(e) => set("adminWelcomeTitle", e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Etiqueta del menú">
            <input value={values.adminMenuLabel} onChange={(e) => set("adminMenuLabel", e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <Field label="Descripción del inicio administrativo">
          <textarea rows={3} value={values.adminWelcomeSubtitle} onChange={(e) => set("adminWelcomeSubtitle", e.target.value)} className={`${fieldClass} min-h-24 resize-y`} />
        </Field>
        <div className="border-t border-outline-variant pt-4 flex flex-col gap-4">
          <h3 className="font-headline-md text-headline-md text-on-surface">Acceso al panel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Título de inicio de sesión">
              <input value={values.adminLoginTitle} onChange={(e) => set("adminLoginTitle", e.target.value)} className={fieldClass} />
            </Field>
            <Field label="Texto de inicio de sesión">
              <input value={values.adminLoginSubtitle} onChange={(e) => set("adminLoginSubtitle", e.target.value)} className={fieldClass} />
            </Field>
          </div>
          <Field label="Etiqueta bajo el logo">
            <input value={values.adminPanelLabel} onChange={(e) => set("adminPanelLabel", e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <div className="border-t border-outline-variant pt-4 flex flex-col gap-3">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Módulos visibles para la empresa</h3>
            <p className="font-body-md text-body-md text-secondary mt-1">
              Seleccione qué opciones aparecerán en el menú del administrador de la empresa. El Dashboard siempre permanece visible.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adminMenuOptions.map((option) => (
              <label
                key={option.key}
                className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3 cursor-pointer hover:border-primary-container transition-colors"
              >
                <input
                  type="checkbox"
                  checked={values.adminMenuVisibility[option.key]}
                  onChange={(e) => setAdminMenuVisibility(option.key, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block font-label-md text-label-md text-on-surface">{option.label}</span>
                  <span className="block font-label-sm text-label-sm text-secondary mt-0.5">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section id="site-settings-theme" role="tabpanel" hidden={activeSection !== "theme"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">palette</span>
          Colores de la plantilla
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          La paleta se aplica al sitio público, al login y al panel administrativo. Use colores con buen contraste para conservar la legibilidad.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Color principal" hint="Botones, enlaces y estados activos.">
            <input type="color" value={values.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-12 w-full rounded border border-outline-variant bg-surface p-1 cursor-pointer" />
          </Field>
          <Field label="Color de acento" hint="Badges, indicadores y destacados.">
            <input type="color" value={values.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-12 w-full rounded border border-outline-variant bg-surface p-1 cursor-pointer" />
          </Field>
          <Field label="Color del panel administrativo" hint="Menú lateral y navegación interna.">
            <input type="color" value={values.adminColor} onChange={(e) => set("adminColor", e.target.value)} className="h-12 w-full rounded border border-outline-variant bg-surface p-1 cursor-pointer" />
          </Field>
          <Field label="Color de fondo" hint="Fondo general del sitio y del panel.">
            <input type="color" value={values.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-12 w-full rounded border border-outline-variant bg-surface p-1 cursor-pointer" />
          </Field>
        </div>
      </section>

      <section id="site-settings-about" role="tabpanel" hidden={activeSection !== "about"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Nosotros
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Estos textos salen en la página Nosotros. Las cifras actuales (500+,
          15 años, 98%) son placeholder hasta que el cliente envíe las reales.
        </p>
        <Field label="Misión">
          <textarea
            rows={8}
            required
            value={values.aboutMission}
            onChange={(e) => set("aboutMission", e.target.value)}
            className={`${fieldClass} min-h-40 resize-y`}
          />
        </Field>
        <div>
          <p className="font-label-sm text-label-sm text-secondary mb-3">
            Cifras
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {values.aboutStats.map((stat, index) => (
              <div
                key={`stat-${index}`}
                className="grid grid-cols-[7rem_1fr] gap-2"
              >
                <Field label={`Cifra ${index + 1}`}>
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => setStat(index, "value", e.target.value)}
                    className={fieldClass}
                    placeholder="500+"
                  />
                </Field>
                <Field label="Etiqueta">
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => setStat(index, "label", e.target.value)}
                    className={fieldClass}
                    placeholder="Propiedades vendidas"
                  />
                </Field>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <p className="font-label-sm text-label-sm text-secondary">
            Tres valores
          </p>
          {values.aboutValues.map((item, index) => (
            <div
              key={`value-${index}`}
              className="flex flex-col gap-3 bg-surface rounded border border-outline-variant p-4"
            >
              <p className="font-label-sm text-label-sm text-secondary">
                Valor {index + 1}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Icono"
                  hint="Nombre Material Symbols: verified, handshake, bolt."
                >
                  <input
                    type="text"
                    value={item.icon}
                    onChange={(e) =>
                      setSiteValue(index, "icon", e.target.value)
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Título">
                  <input
                    type="text"
                    required
                    value={item.title}
                    onChange={(e) =>
                      setSiteValue(index, "title", e.target.value)
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  rows={2}
                  required
                  value={item.description}
                  onChange={(e) =>
                    setSiteValue(index, "description", e.target.value)
                  }
                  className={`${fieldClass} min-h-20 resize-y`}
                />
              </Field>
            </div>
          ))}
        </div>
      </section>

      <section id="site-settings-agent" role="tabpanel" hidden={activeSection !== "agent"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Agente por defecto
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Se muestra en fichas de propiedad cuando no hay un agente asignado.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre">
            <input
              type="text"
              value={values.defaultAgentName}
              onChange={(e) => set("defaultAgentName", e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Cargo">
            <input
              type="text"
              value={values.defaultAgentRole}
              onChange={(e) => set("defaultAgentRole", e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
      </section>

      <section id="site-settings-search" role="tabpanel" hidden={activeSection !== "search"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Buscador — rango de precio
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Configura el slider de precio que ven los visitantes en Inicio y Propiedades.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Paso (USD)" hint="Mín 1,000 · Recomendado 5,000">
            <input
              type="number"
              min={1000}
              max={50000}
              step={1000}
              value={values.priceStep}
              onChange={(e) => set("priceStep", Number(e.target.value) || 5000)}
              className={fieldClass}
            />
          </Field>
          <Field label="Precio mínimo" hint="Por defecto 0">
            <input
              type="number"
              min={0}
              step={1000}
              value={values.priceFloor}
              onChange={(e) => set("priceFloor", Number(e.target.value) || 0)}
              className={fieldClass}
            />
          </Field>
          <Field label="Techo fijo (opcional)" hint="Vacío = auto según catálogo">
            <input
              type="number"
              min={10000}
              step={5000}
              value={values.priceCeilingOverride ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                set("priceCeilingOverride", v === "" ? null : Number(v) || null);
              }}
              placeholder="Auto"
              className={fieldClass}
            />
          </Field>
        </div>
      </section>

      <section id="site-settings-performance" role="tabpanel" hidden={activeSection !== "performance"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">speed</span>
          Catálogo y rendimiento
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Controla cuántas propiedades se renderizan por página — menos tarjetas = menos JS/imágenes y LCP más rápido. Ajusta sin redeploy.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Propiedades por página" hint="6–48 · Recomendado 12">
            <input
              type="number"
              min={6}
              max={48}
              step={1}
              value={values.catalogPerPage}
              onChange={(e) => set("catalogPerPage", Math.min(48, Math.max(6, Number(e.target.value) || 12)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Destacadas en portada" hint="3–12 · LCP home">
            <input
              type="number"
              min={3}
              max={12}
              step={1}
              value={values.featuredLimit}
              onChange={(e) => set("featuredLimit", Math.min(12, Math.max(3, Number(e.target.value) || 6)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Similares en detalle" hint="0–6 · 0 desactiva bloque">
            <input
              type="number"
              min={0}
              max={6}
              step={1}
              value={values.relatedLimit}
              onChange={(e) => set("relatedLimit", Math.min(6, Math.max(0, Number(e.target.value) || 0)))}
              className={fieldClass}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Calidad de imágenes" hint="60–90 · 75 recomendado">
            <input
              type="number"
              min={60}
              max={90}
              step={1}
              value={values.imageQuality}
              onChange={(e) => set("imageQuality", Math.min(90, Math.max(60, Number(e.target.value) || 75)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Hero priority (LCP)" hint="Prioriza la portada">
            <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.heroPriority}
                onChange={(e) => set("heroPriority", e.target.checked)}
                className="accent-[var(--color-primary)] w-4 h-4"
              />
              <span className="font-body-md text-body-md text-on-surface">Cargar hero con priority</span>
            </label>
          </Field>
          <Field label="Animaciones" hint="Desactivar mejora INP en gama baja">
            <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values.enableAnimations}
                onChange={(e) => set("enableAnimations", e.target.checked)}
                className="accent-[var(--color-primary)] w-4 h-4"
              />
              <span className="font-body-md text-body-md text-on-surface">Animaciones decorativas</span>
            </label>
          </Field>
        </div>
      </section>

      <section id="site-settings-cache" role="tabpanel" hidden={activeSection !== "cache"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">cached</span>
          Caché e ISR
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Tiempo en segundos antes de regenerar cada sección (ISR). Valores bajos = contenido más fresco, más carga. 60s es el equilibrio recomendado (Best Practices: evita revalidación excesiva).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Portada (home)" hint="30–600s · Recomendado 60">
            <input
              type="number"
              min={30}
              max={600}
              step={10}
              value={values.revalidateHome}
              onChange={(e) => set("revalidateHome", Math.min(600, Math.max(30, Number(e.target.value) || 60)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Catálogo" hint="30–600s">
            <input
              type="number"
              min={30}
              max={600}
              step={10}
              value={values.revalidateCatalog}
              onChange={(e) => set("revalidateCatalog", Math.min(600, Math.max(30, Number(e.target.value) || 60)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Detalle propiedad" hint="30–600s">
            <input
              type="number"
              min={30}
              max={600}
              step={10}
              value={values.revalidateProperty}
              onChange={(e) => set("revalidateProperty", Math.min(600, Math.max(30, Number(e.target.value) || 60)))}
              className={fieldClass}
            />
          </Field>
        </div>
      </section>

      <section id="site-settings-experience" role="tabpanel" hidden={activeSection !== "experience"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-primary">tune</span>
          Experiencia de búsqueda
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Debounce evita disparar búsquedas y filtros en cada tecla — mejora INP y reduce queries a Supabase. Valores altos = menos carga, respuesta más lenta.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Debounce buscador (ms)" hint="100–800 · Recomendado 350">
            <input
              type="number"
              min={100}
              max={800}
              step={50}
              value={values.searchDebounceMs}
              onChange={(e) => set("searchDebounceMs", Math.min(800, Math.max(100, Number(e.target.value) || 350)))}
              className={fieldClass}
            />
          </Field>
          <Field label="Debounce slider precio (ms)" hint="100–600 · Recomendado 300">
            <input
              type="number"
              min={100}
              max={600}
              step={50}
              value={values.priceSliderDebounceMs}
              onChange={(e) => set("priceSliderDebounceMs", Math.min(600, Math.max(100, Number(e.target.value) || 300)))}
              className={fieldClass}
            />
          </Field>
        </div>
      </section>

      <section id="site-settings-indexing" role="tabpanel" hidden={activeSection !== "indexing"} className="bg-surface-container-low rounded-lg border border-outline-variant p-6 flex flex-col gap-4">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Indexación
        </h2>
        <p className="font-body-md text-body-md text-secondary">
          Mientras esté apagada, buscadores no indexan el sitio (robots,
          sitemap y metadatos en noindex). Actívela cuando el catálogo real
          esté listo.
        </p>
        <label className="inline-flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.indexable}
            onChange={(e) => set("indexable", e.target.checked)}
            className="accent-[var(--color-primary)] w-4 h-4 mt-1"
          />
          <span className="font-body-md text-body-md text-on-surface">
            Permitir indexación en buscadores
          </span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </form>
  );
}
