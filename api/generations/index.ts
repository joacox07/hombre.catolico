import { randomUUID } from "node:crypto";
import { dispararGeneracion } from "../_lib/github.js";
import { requiereSesion, responder } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  const solicitud = `movil-${randomUUID()}`;
  try {
    await dispararGeneracion(solicitud);
    responder(res, 202, { solicitud });
  } catch {
    responder(res, 502, { error: "No se pudo iniciar la generación." });
  }
}
