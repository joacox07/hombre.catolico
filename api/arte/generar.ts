import { imagenEditorial } from "../../pipeline/openai.js";
import { piezaVersionada } from "../_lib/github.js";
import { guardarArteYRender } from "../_lib/arte-guardar.js";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";
import { esSantoConcreto, promptEditorial, validarSolicitudArte } from "../_lib/arte-editorial.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    const entrada = validarSolicitudArte(await cuerpoJson(req));
    const actual = await piezaVersionada(entrada.lote_id, entrada.pieza_id);
    if (esSantoConcreto(actual.pieza)) return responder(res, 409, { error: "Para un santo concreto usá arte histórico con procedencia verificable." });
    const prompt = promptEditorial(actual.pieza, entrada.consulta, entrada.destino);
    const png = await imagenEditorial(prompt, entrada.referencias, { size: entrada.destino === "reel" ? "1024x1536" : "1024x1280" });
    responder(res, 202, await guardarArteYRender(entrada, actual, {
      buffer: png,
      ext: "png",
      carpeta: "generado",
      procedencia: {
        fuente: "ia",
        modelo: process.env.IMAGEN_MODEL || "gpt-image-2",
        prompt,
        licencia: "Generada por IA propia (no es obra histórica)",
        origen_visual: "ia_propia",
        verificado: true,
      },
    }));
  } catch (error: any) {
    responder(res, /inválid|Escribí|referencias|Lote|Pieza|Confirmá/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo generar la imagen." });
  }
}
