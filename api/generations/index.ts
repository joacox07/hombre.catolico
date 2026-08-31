import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { dispararGeneracion } from "../_lib/github.ts";
import { requiereSesion, responder, type ApiRequest } from "../_lib/http.ts";

export default async function handler(req: ApiRequest, res: ServerResponse) {
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
