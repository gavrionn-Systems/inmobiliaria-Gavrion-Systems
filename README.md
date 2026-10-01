# Plantilla inmobiliaria — Web (apps/web)

Beta local del sitio público + panel admin sobre Next.js 16 y Supabase.

## Requisitos

- Node.js >= 20
- Acceso al proyecto Supabase (hosteado) y Supabase CLI (`npx supabase`)

## Configuración inicial

```bash
# 1. Variables de entorno (copiar y completar con los valores del proyecto)
cp .env.example .env.local
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 2. Vincular el proyecto (una vez) y aplicar migraciones
npx supabase link --project-ref <ref>
npx supabase db push
```

## Arranque

```bash
npm install
npm run dev        # desarrollo en http://localhost:3000
npm run build      # build de producción
npm run start      # servir el build en :3000
```

## Acceso del panel

Panel: `/admin`

- Configure los usuarios desde el proyecto Supabase de cada instalación.

El login demo se valida en `lib/demo-auth.ts`. El empleado puede gestionar
propiedades y solicitudes; no accede a Equipo, Categorías ni Ubicaciones.

**Producción:** En Vercel (Production) hace falta
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `ADMIN_PASSWORD`,
`TEMPLATE_ADMIN_PASSWORD` y `EMPLOYEE_PASSWORD`. Configure el dominio propio
de cada inmobiliaria en Vercel.

### Roles

- `template_admin`: configura identidad, branding y Contenido del sitio. Solo
  ve la sección de configuración.
- `admin`: administrador de la inmobiliaria; gestiona propiedades, equipo,
  CRM y operación diaria.
- `agente`: acceso operativo limitado.

En una instalación nueva, cree los usuarios en Supabase Auth. Para convertir
un perfil en administrador de plantilla, asígnele el rol `template_admin` en
`public.profiles` después de aplicar las migraciones.

## Migraciones

Los cambios de esquema viven en `supabase/migrations/` y se aplican con
`npx supabase db push`.

## Bucket de imágenes (`property-images`)

Las fotos del formulario de propiedades se recortan a 16:9 y se suben al bucket
público `property-images`. El bucket y sus políticas están en
`supabase/migrations/20260818100000_property_images_storage.sql`.

Desde `apps/web`, con el proyecto ya vinculado:

```bash
npx supabase db push
```

Ese comando aplica todas las migraciones pendientes, incluida la del bucket
(idempotente: `on conflict` actualiza el bucket si ya existe). Si solo acaba
de clonar, primero ejecute `npx supabase link --project-ref <ref>`.
