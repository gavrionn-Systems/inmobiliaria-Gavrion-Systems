export const site = {
  name: "Nombre de la inmobiliaria",
  url: "https://ejemplo.com",
  logoUrl: "https://placehold.co/256x256/png?text=Logo",
  email: "contacto@ejemplo.com",
  phone: "+000 0000 0000",
  whatsapp: "",
  address: {
    line1: "Ciudad, país",
    line2: "",
  },
  mapUrl:
    "https://maps.google.com",
  social: {
    instagram: "#",
    facebook: "#",
  },
};

export const navItems = [
  { key: "inicio", label: "Inicio", href: "/" },
  { key: "propiedades", label: "Propiedades", href: "/propiedades" },
  { key: "nosotros", label: "Nosotros", href: "/nosotros" },
  { key: "contacto", label: "Contacto", href: "/contacto" },
] as const;

export const adminNav = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "crm", label: "CRM", href: "/admin/crm" },
  { key: "propiedades", label: "Propiedades", href: "/admin/propiedades" },
  { key: "solicitudes", label: "Solicitudes", href: "/admin/solicitudes" },
  { key: "equipo", label: "Equipo", href: "/admin/equipo" },
  { key: "categorias", label: "Categorías", href: "/admin/categorias" },
  { key: "configuracion", label: "Configuración", href: "/admin/configuracion" },
] as const;

export const crmNav = [
  { key: "inbox", label: "Inbox", href: "/admin/crm/inbox", icon: "inbox" },
  { key: "calendario", label: "Calendario", href: "/admin/crm/calendario", icon: "calendar_month" },
  {
    key: "contactos",
    label: "Contactos",
    href: "/admin/crm/contactos",
    icon: "contacts",
  },
  {
    key: "pipeline",
    label: "Pipeline",
    href: "/admin/crm/pipeline",
    icon: "view_kanban",
  },
  { key: "tareas", label: "Tareas", href: "/admin/crm/tareas", icon: "task_alt" },
  {
    key: "configuracion",
    label: "Configuración",
    href: "/admin/crm/configuracion",
    icon: "settings",
    adminOnly: true,
  },
] as const;
