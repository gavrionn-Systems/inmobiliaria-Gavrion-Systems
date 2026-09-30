import Link from "next/link";
import ContactCreateForm from "@/components/admin/crm/ContactCreateForm";
import { getCrmContacts } from "@/lib/crm-queries";
import { formatDate, leadSourceLabel } from "@/lib/format";

export const metadata = { title: "Contactos CRM · Admin" };

export default async function CrmContactsPage() {
  const contacts = await getCrmContacts();

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-1">
            Contactos
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Prospectos y clientes visibles según sus asignaciones.
          </p>
        </div>
        <ContactCreateForm />
      </header>

      {contacts.length === 0 ? (
        <div className="border border-dashed border-outline-variant rounded-lg p-10 text-center">
          <h2 className="font-headline-md text-headline-md">Sin contactos asignados</h2>
          <p className="mt-2 text-secondary">
            Cree uno manualmente o espere una nueva consulta.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-outline-variant rounded-lg bg-surface-container-lowest">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-surface-container-low">
              <tr className="font-label-sm text-label-sm text-secondary">
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/crm/contactos/${contact.id}`}
                      className="font-label-md text-label-md text-primary hover:text-on-primary-container"
                    >
                      {contact.full_name}
                    </Link>
                    <p className="font-label-sm text-label-sm text-secondary">
                      {contact.phone ?? contact.email ?? contact.wa_id}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary-container px-2 py-1 font-label-sm text-label-sm text-on-primary-container">
                      {contact.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">
                    {leadSourceLabel(contact.source)}
                  </td>
                  <td className="px-4 py-3 font-body-md text-body-md text-on-surface-variant">
                    {contact.assignee?.full_name ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3 font-label-sm text-label-sm text-secondary">
                    {formatDate(contact.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
