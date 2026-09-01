/** Descarga de arte de dominio público desde Wikimedia Commons (gratis).
 *  Requiere red abierta (GitHub Actions). Devuelve el binario + procedencia. */

const UA = "hombre-catolico-bot/0.1 (proyecto laical de formación; contacto en el repo)";
const API = "https://commons.wikimedia.org/w/api.php";

export interface Procedencia {
  fuente: "descarga";
  titulo: string;
  autor?: string;
  fuente_url: string;
  licencia: string;
  query: string;
}

export interface ArteDescargado {
  buffer: Buffer;
  ext: string;
  procedencia: Procedencia;
}

/** Busca una obra por texto y baja una miniatura de ancho `width`. */
export async function descargarObra(query: string, width = 1400): Promise<ArteDescargado> {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "1",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(width), format: "json",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikimedia API ${res.status}`);
  const data: any = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  const info = (pages[0] as any)?.imageinfo?.[0];
  if (!info?.thumburl) throw new Error(`Sin resultados de arte para: "${query}"`);

  const img = await fetch(info.thumburl, { headers: { "User-Agent": UA } });
  if (!img.ok) throw new Error(`Descarga de imagen ${img.status}`);
  const buffer = Buffer.from(await img.arrayBuffer());
  const ext = (info.thumburl.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");

  const meta = info.extmetadata || {};
  const strip = (s?: string) => (s ? String(s).replace(/<[^>]+>/g, "").trim() : undefined);
  const licencia = strip(meta.LicenseShortName?.value);
  if (!licencia) throw new Error(`La obra encontrada para "${query}" no informa una licencia verificable.`);
  return {
    buffer,
    ext: ext || "jpg",
    procedencia: {
      fuente: "descarga",
      titulo: strip(meta.ObjectName?.value) || (pages[0] as any)?.title || query,
      autor: strip(meta.Artist?.value),
      fuente_url: info.descriptionurl || info.thumburl,
      licencia,
      query,
    },
  };
}
