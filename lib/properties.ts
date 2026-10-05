const IMG = (token: string) =>
  `https://lh3.googleusercontent.com/aida-public/${token}`;

export const images = {
  hero: IMG(
    "AB6AXuCtOrWjLkKDnNja9kelg0Ca7_QXZY3rgNxIkYvmde0V7SPp9dDktSeipnLumnFUMTzj43nnTRWbDsA0PqRiMqZ_AYu9QT0olB_fhaPtiZ_TxAO6HPzUgHUH32uMlOfOII8KsimodejpaRtE2RjwT2UJZmNX0nPnKDCr3UvYpYhY5mLBZ70SPGAAwjR15yoXDaD8PuaybXjoxU9sPDL6I837pXWZsbvg2cNOX3aX6KctdVDmH8dad9lQew"
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
