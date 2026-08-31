import { ultimoLote } from "../_lib/github.js";
import { requiereSesion, responder } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    responder(res, 200, await ultimoLote());
  } catch {
    responder(res, 502, { error: "No se pudo cargar el último lote." });
  }
}
