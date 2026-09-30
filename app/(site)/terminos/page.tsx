import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const base = settings.url.replace(/\/$/, "");
  const title = `Términos de Servicio | ${settings.name}`;
  const description = `Condiciones de uso del sitio web de ${settings.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `${base}/terminos` },
    openGraph: { title, description, url: `${base}/terminos` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TerminosPage() {
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
        Términos de Servicio
      </h1>
      <p className="font-body-md text-body-md text-secondary mb-2">
        Última actualización: 19 de agosto de 2026.
      </p>
      <p className="font-body-md text-body-md text-secondary mb-stack-lg max-w-3xl">
        Este texto es informativo y describe cómo puede usar el sitio web de{" "}
        {settings.name}. No constituye dictamen jurídico ni sustituye asesoría
        notarial, registral o legal personalizada.
      </p>

      <div className="flex flex-col gap-8 max-w-3xl">
        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            1. Titular del sitio
          </h2>
          <p className="font-body-md text-body-md text-secondary mb-3">
            El sitio es operado por {settings.name}, con domicilio de
            referencia en {address || "la dirección indicada por la empresa"}. Para
            notificaciones relacionadas con estos términos:
          </p>
          <ul className="list-disc pl-6 font-body-md text-body-md text-secondary space-y-1">
            <li>Correo: {settings.email}</li>
            <li>Teléfono: {settings.phone}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            2. Objeto del sitio
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            El sitio funciona como vitrina digital de inmuebles y canal de
            contacto para personas interesadas en comprar, vender, rentar o
            publicar una propiedad. La publicación de un anuncio,
            precio o ficha no constituye por sí sola una oferta irrevocable ni
            un contrato de promesa de compraventa, arrendamiento o
            intermediación. Cualquier negocio se formaliza por escrito, según
            la legislación hondureña aplicable y, cuando corresponda, mediante
            escritura pública ante notario e inscripción en el Instituto de la
            Propiedad.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            3. Uso aceptable
          </h2>
          <p className="font-body-md text-body-md text-secondary mb-3">
            Usted se compromete a utilizar el sitio de forma lícita y de buena
            fe. Queda prohibido, entre otros:
          </p>
          <ul className="list-disc pl-6 font-body-md text-body-md text-secondary space-y-1">
            <li>
              Enviar datos falsos, suplantar identidad o usar el formulario de
              contacto con fines de spam o fraude.
            </li>
            <li>
              Extraer, copiar o republicar el catálogo de forma masiva o
              automatizada sin autorización.
            </li>
            <li>
              Interferir con la seguridad, disponibilidad o integridad del
              sitio.
            </li>
            <li>
              Usar la información de anuncios para hostigar a propietarios,
              ocupantes o terceros.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            4. Información de inmuebles
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Superficies, precios (en lempiras o dólares), fotografías,
            amenidades y estado de una propiedad se publican de buena fe y
            pueden cambiar sin previo aviso. Las medidas y linderos definitivos
            constan en títulos, planos y asientos registrales. {settings.name}{" "}
            puede corregir errores evidentes y retirar anuncios de inmuebles
            ya reservados, vendidos o no disponibles. Le recomendamos
            verificar la información en visita, con documentación de respaldo y,
            si lo desea, con un profesional independiente.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            5. Intermediación y contratos
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Si usted solicita nuestros servicios de intermediación, las
            comisiones, plazos y obligaciones se pactarán en un documento
            separado. Según la jurisdicción aplicable, la transferencia de inmuebles y muchos actos
            relacionados se rigen por el Código Civil, el Código de Comercio
            (cuando aplique), la normativa del Instituto de la Propiedad y las
            formalidades notariales. El uso de este sitio no crea por sí mismo
            un mandato, exclusividad o relación laboral.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            6. Consumidores y usuarios
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Cuando usted actúe como consumidor o usuario, resultan aplicables
            las protecciones de la Ley de Protección al Consumidor (Decreto
            24-2008) y su reglamento, en lo que corresponda a la información
            comercial y a las prácticas de la inmobiliaria. Estos términos no
            pretenden limitar derechos irrenunciables reconocidos por esa
            normativa.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            7. Propiedad intelectual
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Marcas, logotipo, textos, diseño y fotografías del sitio (salvo
            las que pertenezcan a terceros o a los propietarios de los
            inmuebles) son titularidad de {settings.name} o se usan con
            autorización. Queda prohibida su reproducción con fines comerciales
            sin permiso escrito.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            8. Limitación de responsabilidad
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            El sitio se ofrece “tal cual”. En la medida permitida por la ley
            hondureña, {settings.name} no responde por interrupciones técnicas,
            contenidos de sitios enlazados, ni por decisiones de inversión
            tomadas únicamente con base en la información publicada. Nada en
            este apartado excluye responsabilidad por dolo o por obligaciones
            que la ley no permita limitar.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            9. Ley aplicable y jurisdicción
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Estos términos se interpretan conforme a las leyes de la República
            aplicable. Para controversias derivadas del uso del sitio, las
            partes se someten a los tribunales competentes de la jurisdicción
            Distrito Central, Francisco Morazán, sin perjuicio de fueros
            imperativos que correspondan al consumidor.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-3">
            10. Contacto y cambios
          </h2>
          <p className="font-body-md text-body-md text-secondary">
            Podemos actualizar estos términos cuando cambien nuestros
            servicios o la normativa. La versión vigente se publica en esta
            página. Preguntas:{" "}
            <a
              href={`mailto:${settings.email}`}
              className="text-primary hover:underline"
            >
              {settings.email}
            </a>{" "}
            o el formulario de{" "}
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
