import InquiriesList from "@/components/admin/InquiriesList";
import { getInquiries } from "@/lib/admin-queries";

export const metadata = {
  title: "Solicitudes · Admin",
};

export default async function AdminInquiriesPage() {
  const inquiries = await getInquiries();
  const rows = inquiries.map((inq) => ({
    ...inq,
    properties: Array.isArray(inq.properties)
      ? (inq.properties[0] ?? null)
      : ((inq.properties as { title: string; slug: string } | null) ?? null),
  }));

  return (
    <>
      <header className="mb-8">
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
          Solicitudes
        </h1>
        <p className="font-body-md text-body-md text-secondary">
          Mensajes recibidos desde el formulario de contacto del sitio. Las
          solicitudes de asesoría bancaria se marcan con una etiqueta: por su
          complejidad se atienden solo de forma manual y quedan registradas en
          el CRM (Inbox).
        </p>
      </header>

      <InquiriesList rows={rows} />
    </>
  );
}