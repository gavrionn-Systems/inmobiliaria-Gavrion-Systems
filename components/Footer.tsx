import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

function footerBlurb(mission: string) {
  const first =
    mission
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? "";
  if (first.length <= 220) {
    return (
      first ||
      "Acompañamiento profesional para tomar mejores decisiones inmobiliarias."
    );
  }
  return `${first.slice(0, 217).replace(/\s+\S*$/, "")}…`;
}

export default async function Footer() {
  const settings = await getSiteSettings();
  const blurb = footerBlurb(settings.about.mission);

  return (
    <footer className="w-full mt-stack-lg bg-secondary py-stack-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <div className="col-span-1 md:col-span-2">
          <h2 className="font-headline-md text-headline-md text-surface mb-4">
            {settings.name}
          </h2>
          <p className="font-body-md text-body-md text-surface-variant max-w-sm mb-4">
            {blurb}
          </p>
          <p className="font-label-sm text-label-sm text-surface-variant">
            © {new Date().getFullYear()} {settings.name}. Todos los derechos
            reservados.
          </p>
        </div>

        <div className="col-span-1">
          <h3 className="font-label-md text-label-md text-surface font-bold mb-4">
            Legal
          </h3>
          <ul className="space-y-2">
            <li>
              <Link
                href="/terminos"
                className="inline-flex items-center min-h-11 font-label-sm text-label-sm text-surface-variant hover:text-surface transition-colors"
              >
                Términos de Servicio
              </Link>
            </li>
            <li>
              <Link
                href="/privacidad"
                className="inline-flex items-center min-h-11 font-label-sm text-label-sm text-surface-variant hover:text-surface transition-colors"
              >
                Política de Privacidad
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
