import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { metaEventId, parseMetaWebhook } from "../lib/integrations/meta.ts";

function webhookEnvelope(value: Record<string, unknown>) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1234567890",
        changes: [{ field: "messages", value }],
      },
    ],
  };
}

describe("parseMetaWebhook", () => {
  it("parsea un mensaje de texto entrante con nombre de contacto", () => {
    const payload = webhookEnvelope({
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "50422223333", phone_number_id: "111222333" },
      contacts: [{ profile: { name: "Lucía Andino" }, wa_id: "50499887766" }],
      messages: [
        {
          from: "50499887766",
          id: "wamid.abc123",
          timestamp: "1755550000",
          type: "text",
          text: { body: "Hola, ¿sigue disponible?" },
        },
      ],
    });

    const { messages, statuses } = parseMetaWebhook(payload);
    assert.equal(statuses.length, 0);
    assert.equal(messages.length, 1);
    const message = messages[0];
    assert.equal(message.id, "wamid.abc123");
    assert.equal(message.from, "50499887766");
    assert.equal(message.phoneNumberId, "111222333");
    assert.equal(message.contactName, "Lucía Andino");
    assert.equal(message.type, "text");
    assert.equal(message.body, "Hola, ¿sigue disponible?");
    assert.equal(message.mediaId, null);
    assert.equal(message.timestamp, "1755550000");
  });

  it("parsea un mensaje con media (imagen con caption)", () => {
    const payload = webhookEnvelope({
      metadata: { phone_number_id: "111222333" },
      messages: [
        {
          from: "50499887766",
          id: "wamid.img1",
          type: "image",
          image: { id: "MEDIA-ID-1", caption: "Foto de la fachada" },
        },
      ],
    });

    const { messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, "image");
    assert.equal(messages[0].mediaId, "MEDIA-ID-1");
    assert.equal(messages[0].body, "Foto de la fachada");
    // Sin contacts[], usa el número como nombre.
    assert.equal(messages[0].contactName, "50499887766");
  });

  it("parsea respuestas de botones e interactivas", () => {
    const payload = webhookEnvelope({
      messages: [
        {
          from: "1",
          id: "wamid.btn",
          type: "button",
          button: { text: "Sí, agendar" },
        },
        {
          from: "1",
          id: "wamid.list",
          type: "interactive",
          interactive: { list_reply: { id: "op1", title: "Opción 1" } },
        },
      ],
    });

    const { messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].body, "Sí, agendar");
    assert.equal(messages[1].body, "Opción 1");
  });

  it("parsea estados con errores", () => {
    const payload = webhookEnvelope({
      statuses: [
        {
          id: "wamid.sent1",
          status: "delivered",
          timestamp: "1755551111",
          recipient_id: "50499887766",
        },
        {
          id: "wamid.fail1",
          status: "failed",
          errors: [{ code: 131047, title: "Re-engagement message" }],
        },
      ],
    });

    const { statuses } = parseMetaWebhook(payload);
    assert.equal(statuses.length, 2);
    assert.equal(statuses[0].status, "delivered");
    assert.equal(statuses[0].errorCode, null);
    assert.equal(statuses[1].status, "failed");
    assert.equal(statuses[1].errorCode, "131047");
    assert.equal(statuses[1].errorMessage, "Re-engagement message");
  });

  it("ignora mensajes sin id o from, y estados desconocidos", () => {
    const payload = webhookEnvelope({
      messages: [{ type: "text", text: { body: "sin remitente" } }],
      statuses: [{ id: "wamid.x", status: "queued" }],
    });
    const { messages, statuses } = parseMetaWebhook(payload);
    assert.equal(messages.length, 0);
    assert.equal(statuses.length, 0);
  });

  it("tolera payloads malformados sin lanzar", () => {
    assert.deepEqual(parseMetaWebhook(null), {
      messages: [],
      statuses: [],
      templateUpdates: [],
    });
    assert.deepEqual(parseMetaWebhook("texto"), {
      messages: [],
      statuses: [],
      templateUpdates: [],
    });
    assert.deepEqual(parseMetaWebhook({ entry: "no-array" }), {
      messages: [],
      statuses: [],
      templateUpdates: [],
    });
    assert.deepEqual(parseMetaWebhook({ entry: [{ changes: [{}] }] }), {
      messages: [],
      statuses: [],
      templateUpdates: [],
    });
  });

  it("parsea actualizaciones de estado de plantilla", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba",
          changes: [
            {
              field: "message_template_status_update",
              value: {
                event: "APPROVED",
                message_template_id: 99,
                message_template_name: "hola_cliente",
                message_template_language: "es",
              },
            },
          ],
        },
      ],
    };
    const { templateUpdates, messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 0);
    assert.equal(templateUpdates.length, 1);
    assert.equal(templateUpdates[0].name, "hola_cliente");
    assert.equal(templateUpdates[0].language, "es");
    assert.equal(templateUpdates[0].event, "APPROVED");
  });
  it("parsea un mensaje de Messenger (formato messaging[])", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE-ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging: [
                  {
                    sender: { id: "PSID-123" },
                    recipient: { id: "PAGE-ID" },
                    timestamp: 1755552000000,
                    message: {
                      mid: "mid.1457764197618:41d102a3",
                      text: "Hola, vi una propiedad",
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].channel, "messenger");
    assert.equal(messages[0].id, "mid.1457764197618:41d102a3");
    assert.equal(messages[0].from, "PSID-123");
    assert.equal(messages[0].body, "Hola, vi una propiedad");
    assert.equal(messages[0].type, "text");
    assert.equal(messages[0].mediaId, null);
    // Sin perfil en el payload: el webhook coloca el nombre de reserva.
    assert.equal(messages[0].contactName, "");
  });

  it("parsea un mensaje de Instagram y omite ecos", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "IG-ACCOUNT",
          changes: [
            {
              field: "instagram",
              value: {
                messaging: [
                  {
                    sender: { id: "IGSID-9" },
                    recipient: { id: "IG-ACCOUNT" },
                    timestamp: 1755552100000,
                    message: {
                      mid: "ig-mid-1",
                      is_echo: true,
                      text: "eco saliente",
                    },
                  },
                  {
                    sender: { id: "IGSID-9" },
                    recipient: { id: "IG-ACCOUNT" },
                    timestamp: 1755552111000,
                    message: { mid: "ig-mid-2", text: "¿Precio?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].channel, "instagram");
    assert.equal(messages[0].id, "ig-mid-2");
    assert.equal(messages[0].body, "¿Precio?");
  });

  it("parsea adjuntos de Messenger sin texto", () => {
    const payload = {
      object: "page",
      entry: [
        {
          id: "PAGE-ID",
          changes: [
            {
              field: "messages",
              value: {
                messaging: [
                  {
                    sender: { id: "PSID-77" },
                    recipient: { id: "PAGE-ID" },
                    timestamp: 1755552200000,
                    message: {
                      mid: "mid.attach1",
                      attachments: [{ type: "image", payload: {} }],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const { messages } = parseMetaWebhook(payload);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, "image");
    assert.equal(messages[0].body, null);
  });
});

describe("metaEventId", () => {
  it("es determinístico y distingue cuerpos distintos", () => {
    const a = metaEventId('{"a":1}');
    assert.equal(a, metaEventId('{"a":1}'));
    assert.notEqual(a, metaEventId('{"a":2}'));
    assert.match(a, /^[a-f0-9]{64}$/);
  });
});
