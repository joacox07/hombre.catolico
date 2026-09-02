import { randomUUID } from "node:crypto";
import { dispararRenderArte, guardarArchivo, guardarJson } from "./github.js";
import { artePendienteDeRender, portadaDe } from "./arte-editorial.js";

export interface ArteBinario {
  buffer: Buffer;
  ext: string;
  carpeta: "generado" | "seleccionado";
  procedencia: Record<string, unknown>;
}

/** Guarda el asset, su procedencia y la pieza antes de pedir el render. Nunca pasa el binario al navegador. */
export async function guardarArteYRender(entrada: any, actual: any, asset: ArteBinario) {
  const nombre = `${actual.pieza.id}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const archivo = `${asset.carpeta}/${nombre}.${asset.ext}`;
  await guardarArchivo(`assets/arte/${archivo}`, asset.buffer, `Mesa editorial: guardar arte para ${actual.pieza.id}`);
  await guardarJson(`assets/arte/${archivo}.json`, asset.procedencia, null, `Mesa editorial: registrar procedencia de ${actual.pieza.id}`);

  const pieza = structuredClone(actual.pieza);
  const arte = { ...asset.procedencia, archivo };
  if (entrada.destino === "post") {
    pieza.arte = arte;
    (pieza.slides || []).forEach((slide: any) => { delete slide.arte; });
  } else {
    const portada = portadaDe(pieza);
    pieza.reel_portada = {
      arte,
      titulo: portada.titulo || pieza.titulo || pieza.tema || "Hombre Católico",
      kicker: portada.kicker || "Hombre Católico",
      subtitulo: portada.subtitulo || "",
    };
  }
  artePendienteDeRender(pieza);
  const version = await guardarJson(actual.path, pieza, actual.version, `Mesa editorial: aplicar arte a ${actual.pieza.id}`);
  const solicitud = `arte-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await dispararRenderArte(solicitud, entrada.lote_id, actual.pieza.id);
  return { version, solicitud, estado: "renderizando" };
}
