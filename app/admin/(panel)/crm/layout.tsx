import CrmSubNav from "@/components/admin/crm/CrmSubNav";
import { getSession } from "@/lib/auth";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <section>
      <CrmSubNav isAdmin={session?.user.role === "admin"} />
      {children}
    </section>
  );
}
