import { buscarObrasPublicasPorConsultas, ErrorFuenteArte } from "../../pipeline/arte-descarga.js";
import { consultasWikimedia, filtrarCandidatosPorVision } from "../../pipeline/openai.js";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";
import { validarSolicitudArte } from "../_lib/arte-editorial.js";
import { piezaVersionada } from "../_lib/github.js";
import { contextoVisualDePieza, consultasEditorialesBase } from "../../pipeline/perfil-visual.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return responder(res, 405, { error: "Método no permitido." });
  if (!requiereSesion(req, res)) return;
  try {
    const entrada = validarSolicitudArte(await cuerpoJson(req));
    const actual = await piezaVersionada(entrada.lote_id, entrada.pieza_id);
    const contexto = contextoVisualDePieza(actual.pieza, entrada.consulta, entrada.destino);
    const consultas = await consultasWikimedia(contexto, entrada.referencias).catch(() => consultasEditorialesBase(contexto));
    const candidatosBase = await buscarObrasPublicasPorConsultas(consultas, 12, { destino: entrada.destino, texto: [contexto.tema, contexto.titulo, contexto.caption, contexto.consulta].filter(Boolean).join(" "), filtros: entrada.filtros });
    const candidatos = await filtrarCandidatosPorVision(contexto, candidatosBase);
    responder(res, 200, {
      candidatos,
      consultas,
      aviso: candidatos.length ? null : "No encontramos obras que cumplan licencia, calidad y coherencia editorial. Refiná la idea o quitá algún filtro.",
    });
  } catch (error: any) {
    if (error instanceof ErrorFuenteArte) {
      const mensaje = error.codigo === "timeout" ? "La búsqueda tardó demasiado. Reintentá en unos segundos."
        : error.codigo === "saturado" ? "La fuente de imágenes está temporalmente ocupada. Reintentá en unos segundos."
          : "No pudimos conectarnos con la fuente de imágenes. Reintentá en unos segundos.";
      responder(res, error.codigo === "timeout" ? 504 : 503, { error: mensaje });
      return;
    }
    responder(res, /inválid|Escribí|referencias|Lote|Pieza|Filtros/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo buscar arte." });
  }
}
