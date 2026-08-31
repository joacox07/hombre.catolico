/** Verificación determinista de citas: toda frase entre comillas en una pieza debe aparecer
 *  textual en el fragmento_textual de una ficha VERIFICADA. Es el candado anti-cita-falsa;
 *  corre además del concilio (que es criterio, no garantía). */
import type { Ficha } from "./recuperacion.ts";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFC").replace(/[«»“”"]/g, "").replace(/\s+/g, " ").trim();

/** Extrae frases entrecomilladas (« », “ ”, " ") de longitud significativa. */
export function extraerCitas(texto: string): string[] {
  const out: string[] = [];
  const re = /[«"“]([^«»"“”]{15,})[»"”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) out.push(m[1].trim());
  return out;
}

/** Junta todo el texto citable de una pieza (slides + caption + cita). */
function textoPieza(pieza: any): string {
  const partes: string[] = [];
  if (pieza.caption) partes.push(pieza.caption);
  if (pieza.cita) partes.push(pieza.cita);
  for (const s of pieza.slides || []) {
    if (s.cuerpo) partes.push(s.cuerpo);
    if (s.titulo) partes.push(s.titulo);
    if (s.subtitulo) partes.push(s.subtitulo);
  }
  return partes.join("\n");
}

export interface ResultadoCitas {
  ok: boolean;
  citas: Array<{ texto: string; verificada: boolean; ficha?: string }>;
}

/** Verifica cada cita entrecomillada contra las fichas verificadas. */
export function verificarCitas(pieza: any, fichas: Ficha[]): ResultadoCitas {
  const verificadas = fichas.filter((f) => f.verificado);
  const citas = extraerCitas(textoPieza(pieza)).map((texto) => {
    const n = norm(texto);
    const ficha = verificadas.find((f) => norm(f.fragmento_textual).includes(n));
    return { texto, verificada: !!ficha, ficha: ficha?.id };
  });
  return { ok: citas.every((c) => c.verificada), citas };
}
