// Loader para `node --test`: sustituye el paquete virtual "server-only"
// (que solo funciona dentro del runtime de React Server Components) por un
// módulo vacío, permitiendo testear módulos de servidor con node:test.
export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return {
      url: "data:text/javascript,export {};",
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
