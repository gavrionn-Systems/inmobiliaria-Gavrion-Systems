import "server-only";

type HistoryItem = { direction: string; body: string | null };

export type CompanyAssistantInput = {
  company: string;
  assistantName: string;
  instructions: string;
  handoffMessage: string;
  knowledge: string;
  history: HistoryItem[];
  message: string;
  visitorId: string;
};

export type CompanyAssistantReply = {
  reply: string;
  handoff: boolean;
  provider: string;
};

export async function createCompanyReply(
  input: CompanyAssistantInput
): Promise<CompanyAssistantReply> {
  const explicitHandoff =
    /\b(humano|persona|asesor|agente|encargado|queja|reclamo)\b/i.test(
      input.message
    );
  if (explicitHandoff) {
    return { reply: input.handoffMessage, handoff: true, provider: "rule" };
  }

  const system = [
    `Eres ${input.assistantName}, asistente de ${input.company}.`,
    input.instructions,
    "Responde en español, con tono natural y en máximo 90 palabras.",
    "Usa únicamente la información confirmada de la base de conocimiento. No inventes precios, disponibilidad, características ni ubicaciones.",
    "Si no puedes resolverlo, pide un dato concreto o indica que transferirás la conversación.",
    'Devuelve únicamente JSON válido con las propiedades "reply" (string) y "handoff" (boolean).',
  ].join(" ");
  const history = input.history
    .slice(-10)
    .map(
      (item) =>
        `${item.direction === "inbound" ? "Cliente" : "Asistente"}: ${
          item.body ?? ""
        }`,
    )
    .join("\n");
  const prompt = `BASE DE CONOCIMIENTO:\n${input.knowledge || "No hay información cargada."}\n\nCONVERSACIÓN:\n${history}\n\nNUEVO MENSAJE:\n${input.message}`;
  const errors: string[] = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await callGemini(system, prompt);
      return { ...result, provider: "gemini" };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Gemini falló");
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await callOpenAI(input.visitorId, system, prompt);
      return { ...result, provider: "openai" };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "OpenAI falló");
    }
  }

  throw new Error(errors.join(" | ") || "No hay un proveedor de IA configurado");
}

async function callGemini(system: string, prompt: string) {
  const model = (process.env.GEMINI_MODEL || "gemini-2.0-flash")
    .trim()
    .replace(/^models\//i, "");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 360, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `Gemini respondió ${response.status}`);
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("");
  return parseReply(text);
}

async function callOpenAI(visitorId: string, system: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      store: false,
      safety_identifier: visitorId.slice(0, 64),
      instructions: system,
      input: prompt,
      max_output_tokens: 360,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || `OpenAI respondió ${response.status}`);
  const text =
    typeof body.output_text === "string"
      ? body.output_text
      : body.output
          ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
          ?.find((item: { text?: string }) => item.text)?.text;
  return parseReply(text);
}

function parseReply(value: unknown): Omit<CompanyAssistantReply, "provider"> {
  if (typeof value !== "string" || !value.trim()) throw new Error("La IA devolvió una respuesta vacía");
  const parsed = JSON.parse(value.replace(/^```json\s*|\s*```$/g, "")) as {
    reply?: unknown;
    handoff?: unknown;
  };
  return {
    reply: String(parsed.reply || "No pude procesar tu mensaje."),
    handoff: Boolean(parsed.handoff),
  };
}
