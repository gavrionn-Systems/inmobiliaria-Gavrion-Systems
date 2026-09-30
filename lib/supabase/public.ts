import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

/**
 * Cliente anónimo sin cookies: las páginas públicas pueden cachearse (ISR).
 * Retorna null si faltan las env vars para que el build/páginas públicas
 * degraden gracefulmente en vez de fallar.
 */
export const createPublicClient = cache(function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});
