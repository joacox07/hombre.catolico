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

export interface CandidatoArtePublico {
  id: string;
  titulo: string;
  autor?: string;
  licencia: string;
  fuente_url: string;
  thumbnail_url: string;
  query: string;
  razon: string;
}

function strip(s?: string): string | undefined {
  const limpio = s ? String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
  return /(?:label QS|statement QS|special:entitydata)/i.test(limpio) ? undefined : limpio || undefined;
}

function esReutilizable(licencia?: string): licencia is string {
  return !!licencia && /(public domain|cc0|cc by(?:-sa)?)/i.test(licencia) && !/cc by-(?:nc|nd)/i.test(licencia);
}

function pareceIA(...valores: unknown[]): boolean {
  return /\b(?:ai[ -]?generated|artificial intelligence|midjourney|stable diffusion|dall[·.-]?e)\b/i.test(valores.filter(Boolean).join(" "));
}

function candidatoDePagina(page: any, query: string): CandidatoArtePublico | null {
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl || !page?.pageid) return null;
  const categorias = (page.categories || []).map((c: any) => String(c?.title || "")).join(" ");
  const meta = info.extmetadata || {};
  const titulo = strip(meta.ObjectName?.value) || page.title || query;
  const autor = strip(meta.Artist?.value);
  const licencia = strip(meta.LicenseShortName?.value);
  if (!esReutilizable(licencia) || pareceIA(titulo, autor, categorias)) return null;
  return {
    id: String(page.pageid), titulo, autor, licencia,
    fuente_url: info.descriptionurl || info.thumburl,
    thumbnail_url: info.thumburl,
    query,
    razon: "Licencia reutilizable y atmósfera compatible con la dirección editorial.",
  };
}

/** Devuelve opciones públicas verificables; nunca imágenes de Pinterest ni IA ajena. */
export async function buscarObrasPublicas(query: string, limit = 12): Promise<CandidatoArtePublico[]> {
  const limpia = query.trim().slice(0, 240);
  if (!limpia) throw new Error("Escribí qué imagen estás buscando.");
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: limpia, gsrnamespace: "6",
    gsrlimit: String(Math.min(Math.max(limit * 3, 12), 50)),
    prop: "imageinfo|categories", iiprop: "url|extmetadata", cllimit: "30", iiurlwidth: "900", format: "json",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikimedia API ${res.status}`);
  const data: any = await res.json();
  return Object.values(data?.query?.pages ?? {})
    .map((page) => candidatoDePagina(page, limpia))
    .filter((candidato): candidato is CandidatoArtePublico => !!candidato)
    .slice(0, limit);
}

/** Combina búsquedas alternativas, sin repetir una obra ni cambiar sus requisitos de licencia. */
export async function buscarObrasPublicasPorConsultas(consultas: string[], limit = 12): Promise<CandidatoArtePublico[]> {
  const limpias = Array.from(new Set(consultas.map((consulta) => consulta.trim()).filter(Boolean))).slice(0, 3);
  const porId = new Map<string, CandidatoArtePublico>();
  for (const consulta of limpias) {
    const obras = await buscarObrasPublicas(consulta, limit);
    for (const obra of obras) if (!porId.has(obra.id)) porId.set(obra.id, obra);
    if (porId.size >= limit) break;
  }
  return Array.from(porId.values()).slice(0, limit);
}

/** Descarga un candidato exacto por pageid; evita que una segunda búsqueda cambie la obra elegida. */
export async function descargarObraPublica(id: string, width = 1600): Promise<ArteDescargado> {
  if (!/^\d+$/.test(id)) throw new Error("Obra inválida.");
  const params = new URLSearchParams({
    action: "query", pageids: id, prop: "imageinfo|categories", iiprop: "url|extmetadata",
    cllimit: "30", iiurlwidth: String(width), format: "json",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wikimedia API ${res.status}`);
  const data: any = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0] as any;
  const candidato = candidatoDePagina(page, "selección editorial");
  const info = page?.imageinfo?.[0];
  if (!candidato || !info?.thumburl) throw new Error("La obra ya no tiene licencia pública reutilizable.");
  const img = await fetch(info.thumburl, { headers: { "User-Agent": UA } });
  if (!img.ok) throw new Error(`Descarga de imagen ${img.status}`);
  const tipo = img.headers.get("content-type") || "";
  return {
    buffer: Buffer.from(await img.arrayBuffer()),
    ext: tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg",
    procedencia: {
      fuente: "descarga", titulo: candidato.titulo, autor: candidato.autor,
      fuente_url: candidato.fuente_url, licencia: candidato.licencia,
      query: candidato.query, origen_visual: "obra_publica",
    },
  };
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
  const titulo = strip(meta.ObjectName?.value) || (pages[0] as any)?.title || query;
  const autor = strip(meta.Artist?.value);
  const licencia = strip(meta.LicenseShortName?.value);
  const identidad = `${titulo} ${autor || ""} ${categorias}`;
  if (pareceIA(identidad)) {
    throw new Error(`La obra encontrada para "${query}" parece estar marcada como generada por IA.`);
  }
  if (!esReutilizable(licencia)) {
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
