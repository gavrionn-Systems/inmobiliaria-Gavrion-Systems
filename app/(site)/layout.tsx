import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import { getSiteSettings } from "@/lib/site-settings";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <>
      <PageTransition />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-toast focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded"
      >
        Saltar al contenido
      </a>
      <Header logoUrl={settings.logoUrl} name={settings.name} />
      <main id="contenido" className="flex-grow flex flex-col">
        {children}
      </main>
      <Footer />
    </>
  );
}
