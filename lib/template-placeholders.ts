export type TemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string;
  parameters?: { type: string }[];
};

type SlotResult = {
  header: boolean;
  body: string[];
};

const BODY_VAR_RE = /\{\{(\d+)\}\}/g;

export function templateVariableSlots(
  components: TemplateComponent[]
): SlotResult {
  const result: SlotResult = { header: false, body: [] };
  for (const comp of components) {
    if (comp.type === "HEADER" && comp.parameters?.length) {
      result.header = true;
    }
    if (comp.type === "BODY" && comp.text) {
      const seen = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = BODY_VAR_RE.exec(comp.text)) !== null) {
        const key = match[1];
        if (!seen.has(key)) {
          seen.add(key);
          result.body.push(`{{${key}}}`);
        }
      }
    }
  }
  return result;
}

export function fillTemplatePreview(
  bodyPreview: string | null | undefined,
  params: string[]
): string {
  if (!bodyPreview) return "";
  return bodyPreview.replace(BODY_VAR_RE, (_match, index: string) => {
    const idx = Number(index) - 1;
    return params[idx] !== undefined ? params[idx] : `{{${index}}}`;
  });
}
