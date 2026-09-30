import "server-only";
import { z } from "zod";

/** Schemas de validación para las server actions. Los mensajes están en
 *  español porque algunos se muestran directamente en formularios. */

const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const isHttpOrEmpty = (v: string) => v === "" || /^https?:\/\//i.test(v);

export const propertyInputSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().max(30),
  title: z
    .string()
    .trim()
    .min(3, "El título es obligatorio (mínimo 3 caracteres).")
    .max(160),
  slug: z.string().trim().max(80),
  operation: z.enum(["venta", "alquiler"]),
  status: z.enum(["borrador", "publicada", "vendida", "archivada"]),
  price: z.number().min(0, "El precio no es válido.").max(1_000_000_000),
  currency: z.enum(["USD", "HNL"]),
  category_id: z.preprocess(emptyToNull, z.uuid().nullable()),
  location_name: z.string().trim().max(80),
  municipality: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200),
  bedrooms: z.number().int().min(0).max(99).nullable(),
  bathrooms: z.number().min(0).max(99).nullable(),
  parking_spaces: z.number().int().min(0).max(99).nullable(),
  land_area_m2: z.number().min(0).max(100_000_000).nullable(),
  construction_area_m2: z.number().min(0).max(1_000_000).nullable(),
  description: z.string().trim().max(10_000),
  features: z
    .array(
      z.object({
        icon: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(80),
      })
    )
    .max(40),
  main_image_url: z
    .string()
    .trim()
    .max(500)
    .refine(isHttpOrEmpty, "La imagen principal debe ser una URL http(s)."),
  gallery: z
    .array(
      z.object({
        url: z
          .string()
          .trim()
          .max(500)
          .refine(isHttpOrEmpty, "Las imágenes deben ser URLs http(s)."),
        alt: z.string().trim().max(200),
      })
    )
    .max(30),
  is_featured: z.boolean(),
  map_image_url: z
    .string()
    .trim()
    .max(500)
    .refine(isHttpOrEmpty, "El mapa debe ser una URL http(s)."),
});

export const inquirySchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Escriba su nombre completo.")
    .max(120),
  email: z.email("Escriba un email válido.").max(160),
  phone: z.string().trim().max(30).nullable(),
  subject: z.string().trim().min(1, "Escriba un asunto.").max(120),
  message: z
    .string()
    .trim()
    .min(10, "Cuéntenos un poco más (mínimo 10 caracteres).")
    .max(2000),
  property_id: z.uuid().nullable(),
});

export const propertyStatusSchema = z.enum([
  "borrador",
  "publicada",
  "vendida",
  "archivada",
]);

export const inquiryStatusSchema = z.enum(["nueva", "en_proceso", "cerrada"]);

export const appointmentStatusSchema = z.enum([
  "pendiente",
  "confirmada",
  "cancelada",
  "rechazada",
  "completada",
]);

export const appointmentSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Escriba su nombre completo.")
    .max(120),
  email: z.union([z.email("Escriba un email válido.").max(160), z.literal("")]).default(""),
  phone: z.string().trim().max(30).nullable(),
  property_id: z.preprocess(emptyToNull, z.uuid().nullable()),
  starts_at: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida."),
  duration_minutes: z
    .number()
    .int()
    .refine((v) => [30, 60, 90, 120].includes(v), "Duración no válida."),
  motivo: z.string().trim().min(3, "Seleccione el motivo.").max(60),
  notes: z.string().trim().max(500).default(""),
  empresa: z.string().trim().max(200).optional().default(""), // honeypot
});

export const appointmentAvailabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD."),
  duration: z.coerce.number().int().optional().default(60),
  property_id: z.string().optional(),
});

export const uuidSchema = z.uuid();

export type InquiryInput = z.infer<typeof inquirySchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
