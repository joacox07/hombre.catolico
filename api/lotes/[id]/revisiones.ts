import { lotePorId, revisionPorLote, guardarRevision } from "../../_lib/github.js";
import { aplicarRevision, validarRevision } from "../../_lib/revisiones.js";
import { cuerpoJson, requiereSesion, responder } from "../../_lib/http.js";
import { piezaAprobable } from "../../../pipeline/calidad.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  const loteId = req.query?.id;
  if (typeof loteId !== "string" || !/^\d{4}-W\d{2}(?:-[\w-]+)?$/.test(loteId)) return responder(res, 400, { error: "Lote inválido." });
  try {
    const entrada = validarRevision(await cuerpoJson(req));
    const lote = await lotePorId(loteId);
    const item = lote.piezas.find((cualquier: any) => cualquier?.pieza?.id === entrada.pieza_id);
    if (!item) return responder(res, 404, { error: "La pieza no pertenece al lote." });
    if (entrada.decision === "aprobar" && !piezaAprobable(item.pieza)) {
      return responder(res, 409, { error: "La pieza tiene candados de calidad pendientes o alertas bloqueantes." });
    }
    const actual = await revisionPorLote(loteId);
    if (entrada.version !== actual.version) return responder(res, 409, { error: "La revisión cambió en otro dispositivo. Recargá el lote." });
    const contenido = aplicarRevision(actual.contenido, { ...entrada, lote_id: loteId });
    responder(res, 200, await guardarRevision(loteId, contenido, actual.version));
  } catch (error: any) {
    if (error?.status === 409) return responder(res, 409, { error: "La revisión cambió en otro dispositivo. Recargá el lote." });
    if (error instanceof SyntaxError || /inválid|obligatorio|supera/.test(String(error?.message))) {
      return responder(res, 400, { error: error.message });
    }
    responder(res, 502, { error: "No se pudo guardar la revisión." });
  }
}
