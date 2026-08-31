import type { ServerResponse } from "node:http";
import { estadoGeneracion } from "../_lib/github.ts";
import { requiereSesion, responder, type ApiRequest } from "../_lib/http.ts";

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== "GET") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  const solicitud = req.query?.solicitud;
  if (typeof solicitud !== "string" || !/^movil-[a-f0-9-]+$/.test(solicitud)) return responder(res, 400, { error: "Solicitud inválida." });
  try {
    responder(res, 200, await estadoGeneracion(solicitud) || { estado: "queued", resultado: null, url: "" });
  } catch {
    responder(res, 502, { error: "No se pudo consultar la generación." });
  }
}
