import { buscarObrasPublicas } from "../../pipeline/arte-descarga.js";
import { consultaVisual } from "../../pipeline/openai.js";
import { piezaVersionada } from "../_lib/github.js";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";
import { validarSolicitudArte } from "../_lib/arte-editorial.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    const entrada = validarSolicitudArte(await cuerpoJson(req));
    const actual = await piezaVersionada(entrada.lote_id, entrada.pieza_id);
    const base = [entrada.consulta, actual.pieza?.tema, actual.pieza?.pilar].filter(Boolean).join(" ");
    const query = entrada.referencias.length && process.env.OPENAI_API_KEY
      ? await consultaVisual(base, entrada.referencias).catch(() => base)
      : base;
    const candidatos = await buscarObrasPublicas(query);
    responder(res, 200, { candidatos, perfil: query, aviso: candidatos.length ? null : "No hubo obras con licencia reutilizable. Probá otra búsqueda o generá una alternativa original." });
  } catch (error: any) {
    responder(res, /inválid|Escribí|referencias|Lote|Pieza/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo buscar arte." });
  }
}
