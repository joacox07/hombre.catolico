import type { ServerResponse } from "node:http";
import { ultimoLote } from "../_lib/github.ts";
import { requiereSesion, responder, type ApiRequest } from "../_lib/http.ts";

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== "GET") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    responder(res, 200, await ultimoLote());
  } catch {
    responder(res, 502, { error: "No se pudo cargar el último lote." });
  }
}
