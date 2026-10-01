-- Modo de control de la conversación:
--   'ia'     → reservado para una futura integración de asistente.
--   'manual' → un agente/admin tomó la conversación y la IA queda desactivada.
-- Las integraciones externas deben consultar conversations.bot_mode antes de
-- responder; mientras estén en 'manual', solo el equipo envía mensajes.
alter table public.conversations
  add column if not exists bot_mode text not null default 'ia'
    check (bot_mode in ('ia', 'manual'));
