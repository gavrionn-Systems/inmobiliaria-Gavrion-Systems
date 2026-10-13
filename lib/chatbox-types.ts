export type ChatboxSettings = {
  id: number;
  enabled: boolean;
  widget_key: string;
  welcome: string;
  color: string;
  status_message: string;
  offline_message: string;
  position: "left" | "right";
  launcher: string;
  assistant_enabled: boolean;
  assistant_name: string;
  assistant_instructions: string;
  handoff_message: string;
  knowledge: string;
};

export type ChatboxSettingsInput = Omit<
  ChatboxSettings,
  "id" | "widget_key"
>;

export const DEFAULT_CHATBOX_SETTINGS: ChatboxSettings = {
  id: 1,
  enabled: true,
  widget_key: "",
  welcome: "Hola, ¿cómo podemos ayudarte?",
  color: "#506600",
  status_message: "Normalmente respondemos pronto.",
  offline_message: "Estamos fuera de horario. Déjanos tu mensaje.",
  position: "right",
  launcher: "💬",
  assistant_enabled: true,
  assistant_name: "Asistente virtual",
  assistant_instructions:
    "Responde con amabilidad, brevedad y únicamente con información confirmada.",
  handoff_message:
    "Voy a transferir esta conversación a una persona del equipo para ayudarte mejor.",
  knowledge: "",
};
