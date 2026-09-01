import { lotePorId } from "../_lib/github.js";
import { requiereSesion, responder } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  const id = req.query?.id;
  if (typeof id !== "string" || !/^\d{4}-W\d{2}(?:-[\w-]+)?$/.test(id)) return responder(res, 400, { error: "Lote inválido." });
  try {
    responder(res, 200, await lotePorId(id));
  } catch {
    responder(res, 404, { error: "No se encontró ese lote." });
  }
}
