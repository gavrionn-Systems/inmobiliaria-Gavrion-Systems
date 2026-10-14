import CrmSubNav from "@/components/admin/crm/CrmSubNav";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      <CrmSubNav />
      {children}
    </section>
  );
}
