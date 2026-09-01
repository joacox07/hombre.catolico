export const DECISIONES_REVISION = new Set(["aprobar", "cambios", "descartar"]);

export function validarRevision(cuerpo) {
  const pieza_id = typeof cuerpo?.pieza_id === "string" ? cuerpo.pieza_id.trim() : "";
  const decision = typeof cuerpo?.decision === "string" ? cuerpo.decision : "";
  const comentario = typeof cuerpo?.comentario === "string" ? cuerpo.comentario.trim() : "";
  const version = typeof cuerpo?.version === "string" && cuerpo.version ? cuerpo.version : null;
  if (!pieza_id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(pieza_id)) throw new Error("Pieza inválida.");
  if (!DECISIONES_REVISION.has(decision)) throw new Error("Decisión inválida.");
  if ((decision === "cambios" || decision === "descartar") && !comentario) {
    throw new Error("El comentario es obligatorio al pedir cambios o descartar.");
  }
  if (comentario.length > 2000) throw new Error("El comentario supera 2000 caracteres.");
  return { pieza_id, decision, comentario, version };
}

export function revisionVacia(lote_id) {
  return { schema: 1, lote_id, actualizado_en: null, revisiones: {}, eventos: [] };
}

export function aplicarRevision(actual, entrada, ahora = new Date().toISOString()) {
  const base = actual && actual.schema === 1 ? structuredClone(actual) : revisionVacia(entrada.lote_id);
  const evento = {
    pieza_id: entrada.pieza_id,
    decision: entrada.decision,
    comentario: entrada.comentario,
    fecha: ahora,
  };
  base.revisiones = base.revisiones || {};
  base.eventos = Array.isArray(base.eventos) ? base.eventos : [];
  base.revisiones[entrada.pieza_id] = {
    decision: entrada.decision,
    comentario: entrada.comentario,
    actualizado_en: ahora,
  };
  base.eventos.push(evento);
  base.actualizado_en = ahora;
  return base;
}
