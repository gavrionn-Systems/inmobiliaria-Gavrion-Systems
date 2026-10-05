"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLogoutButton({ loginPath }: { loginPath: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(loginPath);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loggingOut}
      className="group flex items-center gap-3 w-full rounded-xl px-3 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors text-left disabled:opacity-60"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-xl text-error-container">
        logout
      </span>
      <span>{loggingOut ? "Saliendo…" : "Cerrar sesión"}</span>
    </button>
  );
}
