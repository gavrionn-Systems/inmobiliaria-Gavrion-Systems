import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_ROUTE_PREFIX,
  DEMO_SESSION_COOKIE,
  adminPanelSlug,
  isAdminOnlyPath,
  isAdminRole,
  isDesignerRole,
  isPlatformOnlyPath,
  isTemplateAdminRole,
  isTemplateOnlyPath,
} from "@/lib/demo-auth";
import { sessionSecret, verifySessionToken } from "@/lib/session-token";

/** Respuesta 404 genérica: no revela que el panel existe. */
function notFound() {
  return new NextResponse(null, { status: 404 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const slug = adminPanelSlug();
  const secretPrefix = `/${slug}`;
  const isDirectAdmin =
    pathname === ADMIN_ROUTE_PREFIX ||
    pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`);
  const isSecretEntry =
    pathname === secretPrefix || pathname.startsWith(`${secretPrefix}/`);

  // Cualquier otra ruta pública pasa sin tocar (el matcher ampliado es
  // inevitable porque el slug secreto se define por env var).
  if (!isDirectAdmin && !isSecretEntry) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  const secret = sessionSecret();
  const session =
    token && secret ? await verifySessionToken(token, secret) : null;

  if (!isDirectAdmin) {
    // Entrada por la ruta secreta: reescritura interna a /admin/...
    if (session && pathname.endsWith("/login")) {
      return NextResponse.redirect(new URL(secretPrefix, request.url));
    }
    const inner = pathname.slice(secretPrefix.length) || "/";
    const targetPath = `${ADMIN_ROUTE_PREFIX}${inner === "/" ? "" : inner}`;
    if (session && ((isTemplateAdminRole(session.role) && !isTemplateOnlyPath(targetPath) && !isPlatformOnlyPath(targetPath)) || (isDesignerRole(session.role) && !isTemplateOnlyPath(targetPath)))) {
      return NextResponse.redirect(new URL(`${ADMIN_ROUTE_PREFIX}/configuracion`, request.url));
    }
    const url = new URL(`${ADMIN_ROUTE_PREFIX}${inner}`, request.url);
    url.search = request.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  // Acceso directo a /admin: invisible (404) para quien no tenga sesión.
  if (!session) {
    return notFound();
  }

  if (pathname.endsWith("/login")) {
    return NextResponse.redirect(new URL(ADMIN_ROUTE_PREFIX, request.url));
  }

  if ((isTemplateAdminRole(session.role) && !isTemplateOnlyPath(pathname) && !isPlatformOnlyPath(pathname)) || (isDesignerRole(session.role) && !isTemplateOnlyPath(pathname))) {
    return NextResponse.redirect(new URL(`${ADMIN_ROUTE_PREFIX}/configuracion`, request.url));
  }

  if (isAdminOnlyPath(pathname) && !isAdminRole(session.role)) {
    const url = new URL(ADMIN_ROUTE_PREFIX, request.url);
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  if (isTemplateOnlyPath(pathname) && !isAdminRole(session.role) && !isTemplateAdminRole(session.role)) {
    const url = new URL(ADMIN_ROUTE_PREFIX, request.url);
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Rutas de primer nivel fuera de las públicas: ahí vive la entrada
    // secreta del panel (el slug exacto lo define ADMIN_PANEL_PATH en runtime).
    "/((?!(?:admin|api|contacto|nosotros|privacidad|propiedades|terminos)(?:/|$)|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml).+)",
  ],
};
