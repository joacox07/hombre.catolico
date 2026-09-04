/** Descarga de arte de dominio público desde Wikimedia Commons (gratis).
 *  Requiere red abierta (GitHub Actions). Devuelve el binario + procedencia. */

const UA = "hombre-catolico-bot/0.1 (proyecto laical de formación; contacto en el repo)";
const API = "https://commons.wikimedia.org/w/api.php";
const TIMEOUT_MS = 12_000;

export class ErrorFuenteArte extends Error {
  constructor(public codigo: "timeout" | "saturado" | "no_disponible" | "respuesta_invalida", mensaje: string) {
    super(mensaje);
    this.name = "ErrorFuenteArte";
  }
}

async function desdeWikimedia(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(url, { ...init, signal: controller.signal });
    if (respuesta.status === 429) throw new ErrorFuenteArte("saturado", "Wikimedia Commons limitó temporalmente las consultas.");
    if (!respuesta.ok) throw new ErrorFuenteArte("no_disponible", `Wikimedia respondió ${respuesta.status}.`);
    return respuesta;
  } catch (error: any) {
    if (error instanceof ErrorFuenteArte) throw error;
    if (error?.name === "AbortError") throw new ErrorFuenteArte("timeout", "La búsqueda en Wikimedia tardó demasiado.");
    throw new ErrorFuenteArte("no_disponible", "No pudimos conectarnos con Wikimedia Commons.");
  } finally { clearTimeout(timer); }
}

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
  fuente: "Wikimedia Commons";
  ancho?: number;
  alto?: number;
  orientacion: "vertical" | "horizontal" | "cuadrada" | "desconocida";
  tipo: "pintura" | "grabado" | "arquitectura" | "escultura" | "fotografia" | "obra";
  periodo?: string;
  puntuacion: number;
}

export interface FiltrosArte {
  licencia?: "todas" | "dominio_publico" | "creative_commons";
  orientacion?: "todas" | "vertical" | "horizontal" | "cuadrada";
  tipo?: "todos" | CandidatoArtePublico["tipo"];
  alta_resolucion?: boolean;
}

export interface ContextoRankingArte {
  destino: "post" | "reel";
  texto?: string;
  filtros?: FiltrosArte;
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

function orientacionDe(ancho?: number, alto?: number): CandidatoArtePublico["orientacion"] {
  if (!ancho || !alto) return "desconocida";
  if (Math.abs(ancho - alto) / Math.max(ancho, alto) < .12) return "cuadrada";
  return alto > ancho ? "vertical" : "horizontal";
}

function tipoDe(titulo: string, categorias: string): CandidatoArtePublico["tipo"] {
  const texto = `${titulo} ${categorias}`.toLowerCase();
  if (/engraving|etching|lithograph|woodcut|print/.test(texto)) return "grabado";
  if (/architecture|churches|cathedral|basilica/.test(texto)) return "arquitectura";
  if (/sculpture|statue/.test(texto)) return "escultura";
  if (/photograph|photography/.test(texto)) return "fotografia";
  if (/painting|paintings|oil on canvas|artgate|google art project|\bwga\d+/.test(texto)) return "pintura";
  return "obra";
}

function periodoDe(meta: any): string | undefined {
  const bruto = strip(meta.DateTimeOriginal?.value) || strip(meta.DateTime?.value);
  const anio = bruto?.match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[1];
  return anio || undefined;
}

function esDocumento(titulo: string, categorias: string, mime?: string): boolean {
  const texto = `${titulo} ${categorias}`.toLowerCase();
  return /\.(?:pdf|djvu|epub)(?:$|\s)|\b(?:encyclopedia|books?|letters|magazine|journal|pamphlet|collection of|historical researches)\b/.test(texto) ||
    (!!mime && !/^image\/(?:jpeg|png|webp)$/i.test(mime));
}

/** Commons mezcla obras con cobertura periodística. Para esta cuenta no basta que la
 * foto muestre un sacerdote: la búsqueda editorial parte de arte o archivo histórico. */
function esFotoDocumentalActual(titulo: string, categorias: string): boolean {
  const texto = `${titulo} ${categorias}`.toLowerCase();
  return /\b(?:photograph|photography|us navy|military|battleship|lccn|closing mass|priest procession|priest aboard|church service|\b20(?:1\d|2\d)\b)\b/.test(texto);
}

function esDominioPublico(licencia: string): boolean { return /public domain|cc0/i.test(licencia); }

function normalizarTexto(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function terminosEditoriales(texto: string): string[] {
  const base = normalizarTexto(texto).match(/[\p{L}\p{N}]{4,}/gu) || [];
  const equivalencias: Record<string, string[]> = {
    sacerdote: ["priest", "confession", "mass", "altar"], priest: ["priest", "confession", "mass", "altar"],
    confesion: ["confession", "absolution"], discernir: ["prayer", "confession", "spiritual"],
    oracion: ["prayer", "praying", "contemplation"], rezar: ["prayer", "praying"],
    matrimonio: ["marriage", "wedding", "couple"], noviazgo: ["courtship", "couple"],
    padre: ["father", "family", "child"], paternidad: ["father", "family", "child"], hijo: ["son", "child", "family"],
    templanza: ["temperance", "virtue", "contemplation"], jose: ["joseph", "carpenter"], carpintero: ["carpenter", "joseph"],
  };
  return Array.from(new Set(base.flatMap((termino) => equivalencias[termino] || [termino]))).slice(0, 12);
}

function coincidenciasEditoriales(candidato: Omit<CandidatoArtePublico, "puntuacion" | "razon">, categorias: string, contexto?: ContextoRankingArte): string[] {
  const texto = normalizarTexto(`${candidato.titulo} ${categorias}`);
  const terminos = terminosEditoriales(contexto?.texto || candidato.query);
  return terminos.filter((termino) => texto.includes(termino));
}

function puntuar(candidato: Omit<CandidatoArtePublico, "puntuacion" | "razon">, categorias: string, contexto?: ContextoRankingArte, coincidencias = coincidenciasEditoriales(candidato, categorias, contexto)): number {
  const relevancia = Math.min(30, coincidencias.length * 10);
  const marca = Math.min(25, 2 + (/(painting|religious|catholic|church|saint|mass|priest|altar|classical|historical)/i.test(`${categorias} ${candidato.titulo}`) ? 10 : 0) + (candidato.tipo === "pintura" || candidato.tipo === "grabado" ? 13 : candidato.tipo === "arquitectura" || candidato.tipo === "escultura" ? 6 : 0));
  const licencia = esDominioPublico(candidato.licencia) ? 20 : 17;
  const pixeles = (candidato.ancho || 0) * (candidato.alto || 0);
  const calidad = pixeles >= 2_000_000 ? 10 : pixeles >= 900_000 ? 7 : pixeles ? 3 : 5;
  const destino = contexto?.destino === "reel" ? "vertical" : "vertical";
  const formato = candidato.orientacion === destino ? 10 : candidato.orientacion === "cuadrada" ? 7 : candidato.orientacion === "desconocida" ? 5 : 3;
  return Math.min(100, relevancia + marca + licencia + calidad + formato);
}

function pasaFiltros(candidato: CandidatoArtePublico, filtros: FiltrosArte = {}): boolean {
  if (filtros.licencia === "dominio_publico" && !esDominioPublico(candidato.licencia)) return false;
  if (filtros.licencia === "creative_commons" && !/^cc by/i.test(candidato.licencia)) return false;
  if (filtros.orientacion && filtros.orientacion !== "todas" && candidato.orientacion !== filtros.orientacion) return false;
  if (filtros.tipo && filtros.tipo !== "todos" && candidato.tipo !== filtros.tipo) return false;
  if (filtros.alta_resolucion && (!candidato.ancho || !candidato.alto || candidato.ancho * candidato.alto < 900_000)) return false;
  return true;
}

function candidatoDePagina(page: any, query: string, contexto?: ContextoRankingArte): CandidatoArtePublico | null {
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl || !page?.pageid) return null;
  const categorias = (page.categories || []).map((c: any) => String(c?.title || "")).join(" ");
  const meta = info.extmetadata || {};
  const titulo = strip(meta.ObjectName?.value) || page.title || query;
  const autor = strip(meta.Artist?.value);
  const licencia = strip(meta.LicenseShortName?.value);
  const ancho = Number.isFinite(info.width) ? info.width : undefined;
  const alto = Number.isFinite(info.height) ? info.height : undefined;
  const identificacion = `${titulo} ${page.title || ""}`;
  if (!esReutilizable(licencia) || pareceIA(identificacion, autor, categorias) || esDocumento(identificacion, categorias, info.mime) || esFotoDocumentalActual(identificacion, categorias)) return null;
  const base = {
    id: String(page.pageid), titulo, autor, licencia,
    fuente_url: info.descriptionurl || info.thumburl,
    thumbnail_url: info.thumburl,
    query,
    fuente: "Wikimedia Commons" as const, ancho, alto, orientacion: orientacionDe(ancho, alto), tipo: tipoDe(identificacion, categorias), periodo: periodoDe(meta),
  };
  const coincidencias = coincidenciasEditoriales(base, categorias, contexto);
  if (contexto?.texto && !coincidencias.length) return null;
  const puntuacion = puntuar(base, categorias, contexto, coincidencias);
  // Sin inspección visual remota no se rellena la galería con coincidencias débiles.
  if (contexto?.texto && puntuacion < 68) return null;
  const candidato: CandidatoArtePublico = {
    ...base, puntuacion,
    razon: `Coincide con ${coincidencias.slice(0, 3).join(", ") || "la consulta"}; licencia ${esDominioPublico(licencia) ? "de dominio público" : "CC reutilizable"}, ${base.tipo} ${base.orientacion}${base.ancho && base.alto ? ` de ${base.ancho}×${base.alto}` : ""}. Puntaje editorial ${puntuacion}/100.`,
  };
  return pasaFiltros(candidato, contexto?.filtros) ? candidato : null;
}

/** Devuelve opciones públicas verificables; nunca imágenes de Pinterest ni IA ajena. */
export async function buscarObrasPublicas(query: string, limit = 12, contexto?: ContextoRankingArte): Promise<CandidatoArtePublico[]> {
  const limpia = query.trim().slice(0, 240);
  if (!limpia) throw new Error("Escribí qué imagen estás buscando.");
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: limpia, gsrnamespace: "6",
    gsrlimit: String(Math.min(Math.max(limit * 3, 12), 50)),
    prop: "imageinfo|categories", iiprop: "url|extmetadata|size|mime", cllimit: "30", iiurlwidth: "900", format: "json",
  });
  const res = await desdeWikimedia(`${API}?${params}`, { headers: { "User-Agent": UA } });
  const data: any = await res.json();
  return Object.values(data?.query?.pages ?? {})
    .map((page) => candidatoDePagina(page, limpia, contexto))
    .filter((candidato): candidato is CandidatoArtePublico => !!candidato)
    .sort((a, b) => b.puntuacion - a.puntuacion || a.titulo.localeCompare(b.titulo, "es"))
    .slice(0, limit);
}

/** Combina búsquedas alternativas, sin repetir una obra ni cambiar sus requisitos de licencia. */
export async function buscarObrasPublicasPorConsultas(consultas: string[], limit = 12, contexto?: ContextoRankingArte): Promise<CandidatoArtePublico[]> {
  const limpias = Array.from(new Set(consultas.map((consulta) => consulta.trim()).filter(Boolean))).slice(0, 4);
  const porId = new Map<string, CandidatoArtePublico>();
  for (const consulta of limpias) {
    const obras = await buscarObrasPublicas(consulta, limit, contexto);
    for (const obra of obras) {
      const existente = porId.get(obra.id);
      if (!existente || obra.puntuacion > existente.puntuacion) porId.set(obra.id, obra);
    }
    // Commons limita consultas rápidas consecutivas; seis alternativas de calidad
    // dan una primera grilla útil sin convertir una búsqueda editorial en un rastreo masivo.
    if (porId.size >= Math.min(limit, 6)) break;
  }
  return Array.from(porId.values()).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, limit);
}

/** Descarga un candidato exacto por pageid; evita que una segunda búsqueda cambie la obra elegida. */
export async function descargarObraPublica(id: string, width = 1600): Promise<ArteDescargado> {
  if (!/^\d+$/.test(id)) throw new Error("Obra inválida.");
  const params = new URLSearchParams({
    action: "query", pageids: id, prop: "imageinfo|categories", iiprop: "url|extmetadata|size|mime",
    cllimit: "30", iiurlwidth: String(width), format: "json",
  });
  const res = await desdeWikimedia(`${API}?${params}`, { headers: { "User-Agent": UA } });
  const data: any = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0] as any;
  const candidato = candidatoDePagina(page, "selección editorial");
  const info = page?.imageinfo?.[0];
  if (!candidato || !info?.thumburl) throw new Error("La obra ya no tiene licencia pública reutilizable.");
  const img = await desdeWikimedia(info.thumburl, { headers: { "User-Agent": UA } });
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
    prop: "imageinfo|categories", iiprop: "url|extmetadata|size|mime", cllimit: "30", iiurlwidth: String(width), format: "json",
  });
  const res = await desdeWikimedia(`${API}?${params}`, { headers: { "User-Agent": UA } });
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

  const img = await desdeWikimedia(info.thumburl, { headers: { "User-Agent": UA } });
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
