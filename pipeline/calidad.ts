/** Puerta de calidad editorial: evidencia, procedencia, voz y resultado del render.
 * Un modelo puede señalar riesgos; la aprobación continúa siendo una decisión humana. */
import type { Ficha } from "./recuperacion.js";
import { verificarCitas } from "./verificar.js";
import { auditarVozHumana } from "./voz-humana.js";
import { chat } from "./texto.js";

export type RiesgoAfirmacion = "normal" | "alto";
export type RespaldoAfirmacion = "claro" | "incierto";

export interface AfirmacionCalidad {
  texto: string;
  fichas: string[];
  riesgo: RiesgoAfirmacion;
  respaldo: RespaldoAfirmacion;
  nota: string;
}

export interface AlertaCalidad {
  codigo: string;
  nivel: "aviso" | "bloqueo";
  detalle: string;
}

export interface ControlCalidad {
  version: 1;
  generado_en: string;
  afirmaciones: AfirmacionCalidad[];
  candados: {
    citas_literales: boolean;
    fuentes_verificadas: boolean;
    arte_procedencia: boolean;
    render_tecnico: "pendiente" | boolean;
  };
  alertas: AlertaCalidad[];
  revision_humana_requerida: boolean;
  bloquea_aprobacion: boolean;
}

function textoPublicable(pieza: any): string {
  const slides = Array.isArray(pieza?.slides) ? pieza.slides : [];
  return [
    pieza?.titulo, pieza?.tema, pieza?.caption, pieza?.cita,
    ...slides.flatMap((slide: any) => [slide?.kicker, slide?.titulo, slide?.subtitulo, slide?.cuerpo, slide?.cta]),
  ].filter((valor): valor is string => typeof valor === "string" && !!valor.trim()).join("\n");
}

function fuentesVerificadas(pieza: any, fichas: Ficha[]): boolean {
  const ids = Array.isArray(pieza?.fuentes) ? pieza.fuentes.filter((id: unknown): id is string => typeof id === "string") : [];
  return ids.length > 0 && ids.every((id: string) => fichas.some((f) => f.id === id && f.verificado));
}

function artesDe(pieza: any): any[] {
  const slides = Array.isArray(pieza?.slides) ? pieza.slides : [];
  return [...(pieza?.arte ? [pieza.arte] : []), ...slides.map((slide: any) => slide?.arte).filter(Boolean)];
}

export function arteConProcedencia(pieza: any): boolean {
  const artes = artesDe(pieza);
  return artes.length > 0 && artes.every((arte) =>
    ["descarga", "ia", "curada"].includes(arte?.fuente) && typeof arte?.archivo === "string" && !!arte.archivo && arte.verificado === true,
  );
}

function jsonSeguro(valor: string): any {
  const limpio = valor.replace(/```json\s*|\s*```/g, "").trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  return JSON.parse(inicio >= 0 && fin > inicio ? limpio.slice(inicio, fin + 1) : limpio);
}

function normalizarAfirmaciones(valor: unknown, fichas: Ficha[]): AfirmacionCalidad[] {
  const permitidas = new Set(fichas.filter((f) => f.verificado).map((f) => f.id));
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item: any) => {
    const texto = typeof item?.texto === "string" ? item.texto.trim().slice(0, 500) : "";
    if (!texto) return [];
    const ids = Array.isArray(item?.fichas) ? item.fichas.filter((id: unknown): id is string => typeof id === "string" && permitidas.has(id)) : [];
    const respaldo: RespaldoAfirmacion = item?.respaldo === "claro" && ids.length ? "claro" : "incierto";
    return [{
      texto,
      fichas: ids,
      riesgo: item?.riesgo === "alto" ? "alto" : "normal",
      respaldo,
      nota: typeof item?.nota === "string" ? item.nota.trim().slice(0, 360) : "",
    }];
  });
}

/** Auditoría auxiliar. No demuestra doctrina: identifica lo que un revisor debe contrastar. */
export async function auditarAfirmaciones(
  pieza: any,
  fichas: Ficha[],
  revisar: typeof chat = chat,
): Promise<{ afirmaciones: AfirmacionCalidad[]; error?: string }> {
  const contexto = fichas.filter((f) => f.verificado).map((f) => ({
    id: f.id,
    afirmacion_que_sostiene: f.afirmacion_que_sostiene,
    fragmento_textual: f.fragmento_textual,
    contexto: f.contexto,
  }));
  try {
    const respuesta = await revisar([
      "Sos un auditor editorial católico. Extraé sólo afirmaciones doctrinales o factuales publicables.",
      "No inventes fuentes ni apruebes contenido. Para cada afirmación indicá si una ficha la respalda claramente.",
      "Si hay síntesis, matiz faltante o contexto insuficiente, usá respaldo:'incierto'.",
      "Devolvé sólo JSON: {afirmaciones:[{texto,fichas:[id],riesgo:'normal'|'alto',respaldo:'claro'|'incierto',nota}]}",
    ].join("\n"), `PIEZA:\n${textoPublicable(pieza)}\n\nFICHAS VERIFICADAS:\n${JSON.stringify(contexto)}`, { json: true });
    return { afirmaciones: normalizarAfirmaciones(jsonSeguro(respuesta)?.afirmaciones, fichas) };
  } catch (error) {
    return { afirmaciones: [], error: String(error).replace(/^Error:\s*/, "").slice(0, 240) };
  }
}

export async function crearControlCalidad(
  pieza: any,
  fichas: Ficha[],
  opts: { sensible?: boolean; revisar?: typeof chat } = {},
): Promise<ControlCalidad> {
  const citas = verificarCitas(pieza, fichas);
  const fuentes = fuentesVerificadas(pieza, fichas);
  const arte = arteConProcedencia(pieza);
  const auditoria = await auditarAfirmaciones(pieza, fichas, opts.revisar || chat);
  const voz = auditarVozHumana(textoPublicable(pieza));
  const alertas: AlertaCalidad[] = [];
  if (!citas.ok) alertas.push({ codigo: "citas_no_verificadas", nivel: "bloqueo", detalle: "Hay citas textuales sin ficha verificada." });
  if (!fuentes) alertas.push({ codigo: "fuentes_no_verificadas", nivel: "bloqueo", detalle: "La pieza no referencia exclusivamente fichas verificadas." });
  if (!arte) alertas.push({ codigo: "arte_sin_procedencia", nivel: "bloqueo", detalle: "El arte final no tiene procedencia verificable." });
  if (auditoria.error) alertas.push({ codigo: "auditoria_afirmaciones_no_disponible", nivel: "bloqueo", detalle: "No se pudo auditar afirmaciones: " + auditoria.error });
  if (auditoria.afirmaciones.some((a) => a.respaldo === "incierto")) {
    alertas.push({ codigo: "afirmaciones_sin_respaldo_claro", nivel: "bloqueo", detalle: "Hay afirmaciones doctrinales o factuales que requieren contraste humano." });
  }
  if (voz.length) alertas.push({ codigo: "voz_a_revisar", nivel: "aviso", detalle: "Se detectaron tics de voz: " + [...new Set(voz.map((h) => h.patron))].join(", ") + "." });
  if (opts.sensible) alertas.push({ codigo: "tema_sensible", nivel: "aviso", detalle: "El tema exige revisión humana explícita." });

  return {
    version: 1,
    generado_en: new Date().toISOString(),
    afirmaciones: auditoria.afirmaciones,
    candados: { citas_literales: citas.ok, fuentes_verificadas: fuentes, arte_procedencia: arte, render_tecnico: "pendiente" },
    alertas,
    revision_humana_requerida: !!opts.sensible || alertas.length > 0,
    bloquea_aprobacion: alertas.some((alerta) => alerta.nivel === "bloqueo"),
  };
}

export function registrarRenderEnCalidad(control: ControlCalidad | undefined, ok: boolean, detalle?: string): ControlCalidad {
  const base: ControlCalidad = control || {
    version: 1, generado_en: new Date().toISOString(), afirmaciones: [],
    candados: { citas_literales: false, fuentes_verificadas: false, arte_procedencia: false, render_tecnico: "pendiente" },
    alertas: [], revision_humana_requerida: true, bloquea_aprobacion: true,
  };
  const alertas = base.alertas.filter((alerta) => alerta.codigo !== "render_tecnico_fallido" && alerta.codigo !== "render_pendiente");
  if (!ok) alertas.push({ codigo: "render_tecnico_fallido", nivel: "bloqueo", detalle: detalle || "El render técnico falló." });
  return {
    ...base,
    candados: { ...base.candados, render_tecnico: ok },
    alertas,
    revision_humana_requerida: base.revision_humana_requerida || !ok,
    bloquea_aprobacion: alertas.some((alerta) => alerta.nivel === "bloqueo"),
  };
}

export function piezaAprobable(pieza: any): boolean {
  const control = pieza?.control_calidad as ControlCalidad | undefined;
  return !!control && control.candados.citas_literales && control.candados.fuentes_verificadas &&
    control.candados.arte_procedencia && control.candados.render_tecnico === true && !control.bloquea_aprobacion;
}
