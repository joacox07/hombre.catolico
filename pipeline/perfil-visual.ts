/** Perfil único que comparten búsqueda y generación de arte editorial. */
export const PERFIL_VISUAL = {
  cuenta: "@hombre.catolico",
  identidad: "católica, masculina, clásica, sobria y formativa",
  paleta: ["carbón #201D19", "tabaco #4B4034", "oliva #555949", "bronce #927B5C", "pergamino #E7DED0", "vino apagado #6A4841"],
  preferir: ["pintura al óleo clásica", "arte sacro", "pintura histórica", "grabados antiguos", "arquitectura religiosa", "escenas contemplativas realistas", "luz cálida", "tonos tierra apagados"],
  evitar: ["fotografía de stock", "meme", "flyer", "caricatura", "dibujo infantil", "neón", "fantasía épica", "texto incrustado", "marca de agua", "estética de videojuego", "cliché masculino agresivo", "otra confesión si el tema es católico"],
} as const;

export type DestinoArte = "post" | "reel";

export interface ContextoVisualEditorial {
  consulta: string;
  destino: DestinoArte;
  tema?: string;
  titulo?: string;
  caption?: string;
  pilar?: string;
  santos?: string[];
  paleta?: string;
}

function limpio(valor: unknown, limite = 280): string {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, limite) : "";
}

/** Sólo campos editoriales: no lleva citas técnicas, secretos ni HTML a proveedores. */
export function contextoVisualDePieza(pieza: any, consulta: string, destino: DestinoArte): ContextoVisualEditorial {
  return {
    consulta: limpio(consulta, 320), destino,
    tema: limpio(pieza?.tema), titulo: limpio(pieza?.titulo), caption: limpio(pieza?.caption),
    pilar: limpio(pieza?.pilar, 80),
    santos: Array.isArray(pieza?.santos) ? pieza.santos.filter((s: unknown): s is string => typeof s === "string").slice(0, 3) : [],
    paleta: limpio(pieza?.direccion_visual?.paleta, 40),
  };
}

/** Búsquedas útiles aun sin modelo: evitan que "Sacerdote" se convierta en un retrato azaroso. */
export function consultasEditorialesBase(contexto: ContextoVisualEditorial): string[] {
  const texto = [contexto.consulta, contexto.tema, contexto.titulo, contexto.caption, ...(contexto.santos || [])].join(" ").toLowerCase();
  const es = (patron: RegExp) => patron.test(texto);
  if (es(/san\s+jos[eé]|joseph.*carpenter|carpinter/)) return [
    "Saint Joseph carpenter historical painting", "Saint Joseph workshop classical religious art", "San José trabajador pintura histórica",
  ];
  if (es(/confesi[oó]n|confession/)) return [
    "Catholic confession historical painting", "priest spiritual direction classical art", "confesión católica pintura histórica",
  ];
  if (es(/discern/) && es(/sacerdot|priest/)) return [
    "Catholic confession painting", "priest spiritual direction classical painting", "Catholic priest at altar painting",
  ];
  if (es(/sacerdot|priest|misa|mass|altar/)) return [
    "Catholic priest at altar painting", "Catholic confession painting", "Catholic Mass historical painting",
  ];
  if (es(/padre|paternidad|hijo|familia/)) return [
    "father teaching son prayer classical painting", "Christian family prayer historical art", "padre enseñando a rezar pintura clásica",
  ];
  if (es(/matrimonio|noviazgo|espos/)) return [
    "Christian marriage historical painting", "Catholic couple prayer classical art", "matrimonio católico pintura histórica",
  ];
  if (es(/templanza|discern|oraci[oó]n|rez(?:ar|ando)/)) return [
    "man praying in church classical painting", "Christian contemplation historical art", "hombre rezando pintura histórica",
  ];
  const sujeto = contexto.consulta || contexto.tema || contexto.titulo || "Christian virtue";
  return [`${sujeto} classical painting`, `${sujeto} historical religious art`, `${sujeto} pintura histórica`];
}

export function resumenPerfilVisual(contexto: ContextoVisualEditorial): string {
  return [
    `Cuenta: ${PERFIL_VISUAL.cuenta}; identidad ${PERFIL_VISUAL.identidad}.`,
    `Pieza: ${[contexto.titulo, contexto.tema, contexto.caption].filter(Boolean).join(" — ")}.`,
    `Destino: ${contexto.destino === "reel" ? "portada vertical 9:16" : "post vertical 4:5"}; paleta ${contexto.paleta || "según la obra"}.`,
    `Preferir: ${PERFIL_VISUAL.preferir.join(", ")}. Evitar: ${PERFIL_VISUAL.evitar.join(", ")}.`,
  ].join("\n");
}
