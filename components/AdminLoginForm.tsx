"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Error de conexión. Intente nuevamente.");
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={login}>
      {error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-medium text-on-surface">
          Usuario o correo electrónico
        </span>
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-secondary" aria-hidden="true">person</span>
          <input
            type="text"
            name="identifier"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="usuario o correo"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 pl-11 font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-label-sm text-label-sm font-medium text-on-surface">
          Contraseña
        </span>
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-secondary" aria-hidden="true">lock</span>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            placeholder="Ingrese su contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 pl-11 pr-11 font-body-md text-body-md text-on-surface outline-none transition-colors placeholder:text-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-secondary transition-colors hover:text-primary"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 font-label-md text-label-md text-on-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-fixed-dim hover:text-on-primary-fixed hover:shadow-md disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
