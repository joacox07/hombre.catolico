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
  origen_visual: "obra_publica";
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
    prop: "imageinfo|categories", iiprop: "url|extmetadata", cllimit: "30", iiurlwidth: String(width), format: "json",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikimedia API ${res.status}`);
  const data: any = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  const info = (pages[0] as any)?.imageinfo?.[0];
  if (!info?.thumburl) throw new Error(`Sin resultados de arte para: "${query}"`);

  const categorias = ((pages[0] as any)?.categories || []).map((c: any) => String(c?.title || "")).join(" ");
  const meta = info.extmetadata || {};
  const strip = (s?: string) => (s ? String(s).replace(/<[^>]+>/g, "").trim() : undefined);
  const titulo = strip(meta.ObjectName?.value) || (pages[0] as any)?.title || query;
  const autor = strip(meta.Artist?.value);
  const licencia = strip(meta.LicenseShortName?.value);
  const identidad = `${titulo} ${autor || ""} ${categorias}`;
  if (/\b(?:ai[ -]?generated|artificial intelligence|midjourney|stable diffusion|dall[·.-]?e)\b/i.test(identidad)) {
    throw new Error(`La obra encontrada para "${query}" parece estar marcada como generada por IA.`);
  }
  const reutilizable = licencia && /(public domain|cc0|cc by(?:-sa)?)/i.test(licencia) && !/cc by-(?:nc|nd)/i.test(licencia);
  if (!reutilizable) {
    throw new Error(`La obra encontrada para "${query}" no tiene una licencia pública reutilizable.`);
  }

  const img = await fetch(info.thumburl, { headers: { "User-Agent": UA } });
  if (!img.ok) throw new Error(`Descarga de imagen ${img.status}`);
  const buffer = Buffer.from(await img.arrayBuffer());
  const tipo = img.headers.get("content-type") || "";
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
  return {
    buffer,
    ext: ext || "jpg",
    procedencia: {
      fuente: "descarga",
      titulo,
      autor,
      fuente_url: info.descriptionurl || info.thumburl,
      licencia,
      query,
      origen_visual: "obra_publica",
    },
  };
}
