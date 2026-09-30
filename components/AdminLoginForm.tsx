"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
    <form className="flex flex-col gap-4" onSubmit={login}>
      {error && (
        <p
          role="alert"
          className="bg-error-container text-on-error-container font-body-md text-body-md px-4 py-3 rounded"
        >
          {error}
        </p>
      )}
      <label className="flex flex-col">
        <span className="font-label-sm text-label-sm text-secondary mb-1">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-surface rounded border border-outline-variant px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col">
        <span className="font-label-sm text-label-sm text-secondary mb-1">
          Contraseña
        </span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-surface rounded border border-outline-variant px-3 py-2.5 pr-11 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-secondary hover:text-primary transition-colors cursor-pointer"
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
        className="bg-primary text-on-primary font-label-md text-label-md py-3 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors mt-2 disabled:opacity-60"
      >
        {loading ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}