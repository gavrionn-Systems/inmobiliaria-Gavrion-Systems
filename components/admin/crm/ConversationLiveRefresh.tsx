"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refresca la conversación cuando llega un mensaje nuevo vía Supabase
 *  Realtime. Si la suscripción falla (Realtime deshabilitado o sin permisos),
 *  degrada a un sondeo cada 10 segundos. */
export default function ConversationLiveRefresh({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!interval) {
        interval = setInterval(() => routerRef.current.refresh(), 10_000);
      }
    };

    const channel = supabase
      .channel(`crm-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => routerRef.current.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => routerRef.current.refresh()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          startPolling();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [conversationId]);

  return null;
}
