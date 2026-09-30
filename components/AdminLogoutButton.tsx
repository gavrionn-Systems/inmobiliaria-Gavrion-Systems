"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminLoginPath } from "@/lib/demo-auth";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(adminLoginPath());
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loggingOut}
      className="px-6 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors text-left disabled:opacity-60"
    >
      {loggingOut ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}