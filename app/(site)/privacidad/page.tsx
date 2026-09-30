import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const base = settings.url.replace(/\/$/, "");
  const title = `Política de Privacidad | ${settings.name}`;
  const description = `Cómo ${settings.name} trata datos de contacto y navegación en su sitio web.`;
  return {
    title,
    description,
    alternates: { canonical: `${base}/privacidad` },
    openGraph: { title, description, url: `${base}/privacidad` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PrivacidadPage() {
  const settings = await getSiteSettings();
  const address = [settings.address.line1, settings.address.line2]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <article className="pt-24 pb-stack-lg max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
      <p className="font-label-md text-label-md text-primary uppercase tracking-widest mb-2">
        Legal
      </p>
      <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-3">
        Política de Privacidad
      </h1>
      <p className="font-body-md text-body-md text-secondary mb-2">
        Última actualización: 19 de agosto de 2026.
      </p>
      <p className="font-body-md text-body-md text-secondary mb-stack-lg max-w-3xl">
        Este aviso explica qué datos personales recabamos a través del sitio
        web de {settings.name} y para qué los usamos. Es un documento
        informativo; no sustituye un dictamen jurídico ni un contrato de
        tratamiento de datos.
      </p>

      <div className="flex flex-col gap-8 max-w-3xl">
        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            1. Responsable
          </h2>
          <p className="font-body-md text-body-md text-secondary mb-3">
            El responsable del tratamiento es {settings.name}, con domicilio
            de referencia en {address || "la dirección indicada por la empresa"}.
          </p>
          <ul className="list-disc pl-6 font-body-md text-body-md text-secondary space-y-1">
            <li>Correo: {settings.email}</li>
            <li>Teléfono: {settings.phone}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            2. Marco legal aplicable
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Reconocemos el derecho a la intimidad y a la inviolabilidad de las
            comunicaciones previsto en la Constitución de la República de
            la jurisdicción aplicable. También observamos, en lo aplicable, la normativa de protección
            al Consumidor (Decreto 24-2008) respecto de la información que
            usted nos entrega como usuario. La normativa aplicable puede cambiar, por lo que
            esta versión, con un régimen equivalente al Reglamento General de
            Protección de Datos de la Unión Europea; aun así, tratamos sus
            datos con finalidad limitada, minimización y medidas de seguridad
            razonables.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            3. Datos que recabamos
          </h2>
          <p className="font-body-md text-body-md text-secondary mb-3">
            Según cómo use el sitio, podemos tratar:
          </p>
          <ul className="list-disc pl-6 font-body-md text-body-md text-secondary space-y-1">
            <li>
              Identificación y contacto: nombre, correo electrónico, teléfono
              y mensaje, cuando envía el formulario de contacto o escribe por
              WhatsApp.
            </li>
            <li>
              Contexto comercial: inmueble de interés, presupuesto o tipo de
              operación (compra, venta, renta o publicación).
            </li>
            <li>
              Datos técnicos básicos del navegador (dirección IP, tipo de
              dispositivo y páginas visitadas) necesarios para operar y
              proteger el sitio.
            </li>
          </ul>
          <p className="font-body-md text-body-md text-secondary mt-3">
            No solicitamos números de identidad, estados de cuenta ni copias
            de títulos a través del formulario público. Si más adelante se
            requiere documentación para una transacción, se le indicará por un
            canal directo y con una finalidad concreta.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            4. Finalidades
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Usamos los datos para responder su consulta, coordinar visitas,
            dar seguimiento comercial a solicitudes inmobiliarias, mejorar el
            sitio y cumplir obligaciones legales o requerimientos de
            autoridad. No vendemos bases de datos a terceros. El envío del
            formulario o de un mensaje de WhatsApp se entiende como
            consentimiento para que le contactemos respecto de esa solicitud.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            5. Conservación y encargados
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Conservamos las solicitudes el tiempo necesario para atenderlas y
            para un seguimiento comercial razonable, o el que imponga la ley
            (por ejemplo, obligaciones contables). El sitio puede alojarse en
            proveedores de hosting, correo o mensajería ubicados fuera de
            la jurisdicción aplicable. Esa transferencia se hace para prestar el servicio, no
            para comercializar sus datos.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            6. Destinatarios
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Pueden conocer sus datos asesores de {settings.name} que gestionen
            su caso, y proveedores que hostean el sitio o el correo, sujetos a
            deber de confidencialidad. También podríamos comunicarlos si una
            autoridad hondureña competente lo requiere conforme a ley, o si
            usted nos pide presentar su interés a un propietario o
            copropietario.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            7. Cookies
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            El sitio puede usar cookies técnicas o de sesión para mantener la
            seguridad (por ejemplo, el acceso al panel administrativo) y el
            funcionamiento básico. No usamos esas cookies para vender
            publicidad comportamental a terceros. Puede configurar su
            navegador para bloquear cookies; algunas funciones podrían dejar
            de estar disponibles.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            8. Sus opciones
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Puede pedir acceso, corrección o eliminación de los datos que nos
            haya enviado, o que dejemos de contactarle con fines comerciales,
            escribiendo a{" "}
            <a
              href={`mailto:${settings.email}`}
              className="text-primary hover:underline"
            >
              {settings.email}
            </a>
            . Atenderemos la solicitud en un plazo razonable, salvo que deba
            conservarse información por un deber legal o para el ejercicio de
            derechos.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            9. Menores de edad
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Los servicios inmobiliarios de este sitio están dirigidos a
            personas con capacidad legal para contratar. No buscamos recabar
            datos de menores de dieciocho (18) años. Si un padre, madre o tutor
            advierte que un menor nos envió información, puede solicitar su
            supresión al correo indicado.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            10. Seguridad y cambios
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Aplicamos medidas técnicas y organizativas razonables; ningún
            sistema es infalible. Si actualizamos esta política, publicaremos
            la nueva versión en esta página. Más información o el ejercicio de
            sus opciones:{" "}
            <Link href="/contacto" className="text-primary hover:underline">
              contacto
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
