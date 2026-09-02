import { buscarObrasPublicasPorConsultas } from "../../pipeline/arte-descarga.js";
import { consultasWikimedia } from "../../pipeline/openai.js";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";
import { validarSolicitudArte } from "../_lib/arte-editorial.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    const entrada = validarSolicitudArte(await cuerpoJson(req));
    const consultas = await consultasWikimedia(entrada.consulta, entrada.referencias).catch(() => [entrada.consulta]);
    const candidatos = await buscarObrasPublicasPorConsultas(consultas);
    responder(res, 200, {
      candidatos,
      consultas,
      aviso: candidatos.length ? null : "No hubo obras reutilizables. Probá una de estas búsquedas sugeridas.",
    });
  } catch (error: any) {
    responder(res, /inválid|Escribí|referencias|Lote|Pieza/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo buscar arte." });
  }
}
