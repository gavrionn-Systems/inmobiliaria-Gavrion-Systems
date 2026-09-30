const IMG = (token: string) =>
  `https://lh3.googleusercontent.com/aida-public/${token}`;

export const images = {
  hero: IMG(
    "AB6AXuCtOrWjLkKDnNja9kelg0Ca7_QXZY3rgNxIkYvmde0V7SPp9dDktSeipnLumnFUMTzj43nnTRWbDsA0PqRiMqZ_AYu9QT0olB_fhaPtiZ_TxAO6HPzUgHUH32uMlOfOII8KsimodejpaRtE2RjwT2UJZmNX0nPnKDCr3UvYpYhY5mLBZ70SPGAAwjR15yoXDaD8PuaybXjoxU9sPDL6I837pXWZsbvg2cNOX3aX6KctdVDmH8dad9lQew"
  ),
  mapaContacto: IMG(
    "AB6AXuAL4S76nwXKBg-IxB_C6PWvxS8FmJ7eS36Y-Ltj_wNz_XNVcjVnyXJzsXYHlqaUTfa1hBhRE-hCNu5VTq8Q52OjGd-gPcBYPgMhjKrWqrBbbMwaS29580xwernm5ETTiuV7B3FMhMG90RdVIzhgqouBA9gD065Tj212uu3lFxI4J4rGt5KxdrLs4yY5MhqMDVcpQHUj0CL3dtjKedSRX1Rd1TJ14oK6fjZdPxwA1m_XHTrZ71vF-Kp9Ow"
  ),
};

export type PropertyStatus = "disponible" | "destacado" | "vendido";

export interface PropertySummary {
  id: string;
  title: string;
  location: string;
  price: string;
  priceSuffix?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  area?: number | string;
  type?: string;
  image: string;
  imageAlt: string;
  status: PropertyStatus;
}

// Los datos de ejemplo del seed viven en scripts/seed.mts (datos de prueba
// del mercado hondureño), no en el código de producción.
