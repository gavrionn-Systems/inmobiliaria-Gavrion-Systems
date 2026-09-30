import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente de servidor con clave de servicio (bypasa RLS).
 *  Solo para el panel admin y scripts. Nunca importar en cliente. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}