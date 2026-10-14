import { redirect } from "next/navigation";

export const metadata = { title: "CRM · Admin" };

/** La configuración técnica del CRM no forma parte del panel de empresa. */
export default function CrmConfigurationPage() {
  redirect("/admin/crm/inbox");
}
