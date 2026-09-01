import { randomUUID } from "node:crypto";
import { descargarObraPublica } from "../../pipeline/arte-descarga.ts";
import { dispararRenderArte, guardarArchivo, guardarJson, piezaVersionada } from "../_lib/github.js";
import { artePendienteDeRender, portadaDe, validarSolicitudArte } from "../_lib/arte-editorial.ts";
import { cuerpoJson, requiereSesion, responder } from "../_lib/http.js";

function imagenIA(valor: unknown) {
  const match = typeof valor === "string" && valor.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Imagen generada inválida.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 6_000_000) throw new Error("Imagen generada demasiado grande.");
  return { buffer, ext: match[1] === "jpeg" ? "jpg" : match[1] };
}

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
    let buffer: Buffer, ext: string, procedencia: any;
    if (source.tipo === "wikimedia") {
      const obra = await descargarObraPublica(String(source.id || ""));
      buffer = obra.buffer; ext = obra.ext; procedencia = { ...obra.procedencia, verificado: true };
    } else if (source.tipo === "ia") {
      const ia = imagenIA(source.image_data);
      buffer = ia.buffer; ext = ia.ext;
      procedencia = {
        fuente: "ia", modelo: process.env.IMAGEN_MODEL || "gpt-image-2", prompt: String(source.prompt || "").slice(0, 3000),
        licencia: "Generada por IA propia (no es obra histórica)", origen_visual: "ia_propia", verificado: true,
      };
    } else throw new Error("Elegí una obra pública o una imagen generada.");

    const nombre = `${actual.pieza.id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const carpeta = source.tipo === "ia" ? "generado" : "seleccionado";
    const archivo = `${carpeta}/${nombre}.${ext}`;
    await guardarArchivo(`assets/arte/${archivo}`, buffer, `Mesa editorial: guardar arte para ${actual.pieza.id}`);
    await guardarJson(`assets/arte/${archivo}.json`, procedencia, null, `Mesa editorial: registrar procedencia de ${actual.pieza.id}`);

    const pieza = structuredClone(actual.pieza);
    const arte = { ...procedencia, archivo };
    if (entrada.destino === "post") {
      pieza.arte = arte;
      (pieza.slides || []).forEach((slide: any) => { delete slide.arte; });
    } else {
      const portada = portadaDe(pieza);
      pieza.reel_portada = { arte, titulo: portada.titulo || pieza.titulo || pieza.tema || "Hombre Católico", kicker: portada.kicker || "Hombre Católico", subtitulo: portada.subtitulo || "" };
    }
    artePendienteDeRender(pieza);
    const version = await guardarJson(actual.path, pieza, actual.version, `Mesa editorial: aplicar arte a ${actual.pieza.id}`);
    const solicitud = `arte-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await dispararRenderArte(solicitud, entrada.lote_id, actual.pieza.id);
    responder(res, 202, { version, solicitud, estado: "renderizando" });
  } catch (error: any) {
    if (error?.status === 409) return responder(res, 409, { error: "La pieza cambió en otro dispositivo. Recargá el lote." });
    responder(res, /inválid|Escribí|referencias|Lote|Pieza|Elegí|demasiado|Confirmá/.test(String(error?.message)) ? 400 : 502, { error: error.message || "No se pudo aplicar el arte." });
  }
}
