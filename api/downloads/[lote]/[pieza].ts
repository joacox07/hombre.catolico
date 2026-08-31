import { descarga } from "../../_lib/github.js";
import { requiereSesion, responder } from "../../_lib/http.js";

const ID = /^[A-Za-z0-9_-]+$/;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  const lote = req.query?.lote;
  const pieza = req.query?.pieza;
  if (typeof lote !== "string" || typeof pieza !== "string" || !ID.test(lote) || !ID.test(pieza)) return responder(res, 400, { error: "Descarga inválida." });
  try {
    const url = await descarga(lote, pieza);
    if (!url) return responder(res, 404, { error: "La descarga todavía no está disponible." });
    res.writeHead(302, { Location: url, "Cache-Control": "no-store" });
    res.end();
  } catch {
    responder(res, 404, { error: "La descarga todavía no está disponible." });
  }
}
