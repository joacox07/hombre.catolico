import { descargarObraPublica, ErrorFuenteArte } from "../../pipeline/arte-descarga.js";
import { piezaVersionada } from "../_lib/github.js";
import { guardarArteYRender } from "../_lib/arte-guardar.js";
import { validarSolicitudArte } from "../_lib/arte-editorial.js";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    const cuerpo = await cuerpoJson(req);
    const entrada = validarSolicitudArte(cuerpo);
    const actual = await piezaVersionada(entrada.lote_id, entrada.pieza_id);
    if (typeof cuerpo.version !== "string" || cuerpo.version !== actual.version) {
      return responder(res, 409, { error: "La pieza cambió en otro dispositivo. Recargá el lote." });
    }
    const source = cuerpo.candidato || {};
    if (source.tipo !== "wikimedia") throw new Error("Elegí una obra pública reutilizable.");
    const obra = await descargarObraPublica(String(source.id || ""));
    const buffer = obra.buffer;
    const ext = obra.ext;
    const procedencia = { ...obra.procedencia, verificado: true };

    responder(res, 202, await guardarArteYRender(entrada, actual, {
      buffer, ext, procedencia, carpeta: "seleccionado",
    }));
  } catch (error: any) {
    if (error?.status === 409) return responder(res, 409, { error: "La pieza cambió en otro dispositivo. Recargá el lote." });
    if (error instanceof ErrorFuenteArte) {
      return responder(res, error.codigo === "timeout" ? 504 : 503, { error: error.codigo === "timeout" ? "La descarga de la obra tardó demasiado. Reintentá en unos segundos." : error.codigo === "saturado" ? "La fuente de imágenes está temporalmente ocupada. Reintentá en unos segundos." : "No pudimos descargar la obra desde su fuente original. Reintentá en unos segundos." });
    }
    responder(res, /inválid|Escribí|referencias|Lote|Pieza|Elegí|Confirmá/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo aplicar el arte." });
  }
}
