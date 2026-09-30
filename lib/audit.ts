import "server-only";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inserta en audit_log usando service_role para no depender de RLS.
 *  Si el usuario es demo (id ausente o no-uuid) guarda email en metadata. */
export async function auditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const session = await getSession();
    if (!session) return;
    const actorId = session.user.id;
    const isUuid = actorId ? UUID_RE.test(actorId) : false;
    const supabase = createAdminClient();
    const metadata = {
      ...(params.metadata ?? {}),
      ...(isUuid ? {} : { actor_email: session.user.email, actor_name: session.user.name }),
    };
    const { error } = await supabase.from("audit_log").insert({
      actor_id: isUuid ? actorId : null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      metadata,
    });
    if (error) console.error("[audit] No se pudo registrar:", error);
  } catch (e) {
    console.error("[audit] excepción:", e);
  }
}
