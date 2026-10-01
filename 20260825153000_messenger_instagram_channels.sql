-- Canales de recepción Messenger e Instagram (solo entrada; sin envío aún).
alter table public.conversations drop constraint conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check
  check (channel in ('whatsapp', 'web', 'instagram', 'messenger'));
