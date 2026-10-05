import type { Metadata } from "next";
import Image from "next/image";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: `Iniciar sesión | ${settings.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage() {
  const settings = await getSiteSettings();

  return (
    <section className="min-h-screen bg-surface flex items-center justify-center px-margin-mobile">
      <div className="w-full max-w-md bg-surface-container-low rounded-lg border border-outline-variant p-8">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <Image
            src={settings.logoUrl}
            alt={`Logo de ${settings.name}`}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <h1 className="font-headline-md text-headline-md text-on-surface">
            {settings.adminLoginTitle}
          </h1>
        </div>
        <p className="font-body-md text-body-md text-secondary mb-6 text-center">
          {settings.adminLoginSubtitle}
        </p>
        <AdminLoginForm />
      </div>
    </section>
  );
}
