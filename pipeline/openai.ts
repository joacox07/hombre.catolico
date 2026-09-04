/** Cliente mínimo de OpenAI (texto + imágenes) usando fetch nativo de Node 20+.
 *  Sin dependencias. La key sale de OPENAI_API_KEY. Corre en GitHub Actions (red abierta);
 *  en este sandbox la red externa está capada, así que se valida al correr en Actions. */

import { consultasEditorialesBase, resumenPerfilVisual, type ContextoVisualEditorial } from "./perfil-visual.js";
import type { CandidatoArtePublico } from "./arte-descarga.js";

const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("Falta OPENAI_API_KEY (secreto del repo / variable de entorno).");
  return k;
}

async function post(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI ${path} → ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

async function postForm(path: string, body: FormData): Promise<any> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${apiKey()}` }, body });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI ${path} → ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

/** Chat de texto. Devuelve el string del mensaje. json=true fuerza respuesta JSON. */
export async function chat(system: string, user: string, opts: { json?: boolean; model?: string } = {}): Promise<string> {
  const model = opts.model || process.env.OPENAI_TEXT_MODEL || "gpt-4o";
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const data = await post("/chat/completions", body);
  return data.choices?.[0]?.message?.content ?? "";
}

/** Genera una imagen con GPT Image. Devuelve el PNG como Buffer. */
export async function imagen(prompt: string, opts: { size?: string; quality?: string; model?: string } = {}): Promise<Buffer> {
  const data = await post("/images/generations", {
    model: opts.model || process.env.IMAGEN_MODEL || "gpt-image-2",
    prompt,
    size: opts.size || process.env.IMAGEN_SIZE || "1024x1536",
    quality: opts.quality || process.env.IMAGEN_QUALITY || "high",
    n: 1,
  });
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI images: respuesta sin b64_json");
  return Buffer.from(b64, "base64");
}

function referenciaDataUrl(valor: string): { mime: string; buffer: Buffer; ext: string } | null {
  const match = valor.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 400_000) return null;
  return { mime: match[1], buffer, ext: match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg" };
}

/** Genera una alternativa propia; referencias se mandan una sola vez y no se guardan. */
export async function imagenEditorial(prompt: string, referencias: string[], opts: { size: string }): Promise<Buffer> {
  const validas = referencias.map(referenciaDataUrl).filter((ref): ref is NonNullable<typeof ref> => !!ref);
  if (!validas.length) return imagen(prompt, { size: opts.size });
  const form = new FormData();
  form.set("model", process.env.IMAGEN_MODEL || "gpt-image-2");
  form.set("prompt", prompt);
  form.set("size", opts.size);
  form.set("quality", process.env.IMAGEN_QUALITY || "high");
  validas.forEach((ref, index) => {
    const bytes = Uint8Array.from(ref.buffer);
    form.append("image", new Blob([bytes], { type: ref.mime }), `referencia-${index + 1}.${ref.ext}`);
  });
  const data = await postForm("/images/edits", form);
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI images: respuesta sin b64_json");
  return Buffer.from(b64, "base64");
}

function consultasSeguras(valor: unknown, respaldo: string[]): string[] {
  const candidatas = Array.isArray(valor) ? valor : [];
  const limpias = candidatas
    .filter((consulta): consulta is string => typeof consulta === "string")
    .map((consulta) => consulta.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter((consulta) => consulta.length >= 3);
  return Array.from(new Set([...limpias, ...respaldo.map((consulta) => consulta.trim().slice(0, 240))])).slice(0, 4);
}

/** Convierte una intención editorial a búsquedas breves para Wikimedia; las referencias sólo orientan, nunca se guardan. */
export async function consultasWikimedia(entrada: ContextoVisualEditorial | string, referencias: string[]): Promise<string[]> {
  const contexto: ContextoVisualEditorial = typeof entrada === "string" ? { consulta: entrada, destino: "post" } : entrada;
  const base = consultasEditorialesBase(contexto);
  if (!process.env.OPENAI_API_KEY) return base;
  const contenido: any[] = [{
    type: "text",
    text: `${resumenPerfilVisual(contexto)}\n\nPedido del editor: ${contexto.consulta}\nDevolvé JSON estricto {"consultas":["..."]} con dos a cuatro búsquedas breves, preferentemente en inglés y una alternativa en español, para Wikimedia Commons. Cada búsqueda debe describir sujeto, acción, lugar, época o estilo y atmósfera coherentes con la pieza. No inventes artistas, no copies una obra ni devuelvas libros, documentos, fotos de stock o términos de marca.`,
  }];
  referencias.forEach((referencia) => contenido.push({ type: "image_url", image_url: { url: referencia, detail: "low" } }));
  const data = await post("/chat/completions", {
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4o",
    messages: [{ role: "system", content: "Sos director de arte católico. Proponé sólo búsquedas de obras públicas, históricas o artísticas que respeten el perfil editorial recibido." }, { role: "user", content: contenido }],
    response_format: { type: "json_object" },
    max_tokens: 80,
  });
  const salida = String(data.choices?.[0]?.message?.content || "");
  try { return consultasSeguras(JSON.parse(salida)?.consultas, base); }
  catch { return base; }
}

/** Auditoría visual opcional: sólo se activa con un modelo de visión configurado.
 * No persiste miniaturas ni reemplaza la revisión editorial humana del encuadre. */
export async function filtrarCandidatosPorVision(contexto: ContextoVisualEditorial, candidatos: CandidatoArtePublico[]): Promise<CandidatoArtePublico[]> {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_VISION_MODEL || !candidatos.length) return candidatos;
  const muestra = candidatos.slice(0, 8);
  const contenido: any[] = [{
    type: "text",
    text: `${resumenPerfilVisual(contexto)}\n\nRevisá las miniaturas candidatas. Devolvé JSON estricto {"aprobados":["pageid"]}. Aprobá sólo si la imagen realmente representa la intención editorial y es compatible con arte católico clásico y sobrio. Rechazá foto documental moderna, sujeto distinto, texto o marca de agua, estética de stock/IA, símbolos incoherentes y elementos relevantes que se perderían en un recorte ${contexto.destino === "reel" ? "9:16" : "4:5"}.`,
  }];
  muestra.forEach((candidato) => {
    contenido.push({ type: "text", text: `Candidato ${candidato.id}: ${candidato.titulo}.` });
    contenido.push({ type: "image_url", image_url: { url: candidato.thumbnail_url, detail: "low" } });
  });
  try {
    const data = await post("/chat/completions", {
      model: process.env.OPENAI_VISION_MODEL,
      messages: [{ role: "system", content: "Sos auditor visual católico. Priorizá precisión y descartá antes que aprobar una imagen dudosa." }, { role: "user", content: contenido }],
      response_format: { type: "json_object" }, max_tokens: 180,
    });
    const aprobados = new Set((JSON.parse(String(data.choices?.[0]?.message?.content || "{}"))?.aprobados || []).map(String));
    return muestra.filter((candidato) => aprobados.has(candidato.id));
  } catch {
    return candidatos;
  }
}
