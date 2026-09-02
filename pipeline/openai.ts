/** Cliente mínimo de OpenAI (texto + imágenes) usando fetch nativo de Node 20+.
 *  Sin dependencias. La key sale de OPENAI_API_KEY. Corre en GitHub Actions (red abierta);
 *  en este sandbox la red externa está capada, así que se valida al correr en Actions. */

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

function consultasSeguras(valor: unknown, respaldo: string): string[] {
  const candidatas = Array.isArray(valor) ? valor : [];
  const limpias = candidatas
    .filter((consulta): consulta is string => typeof consulta === "string")
    .map((consulta) => consulta.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120))
    .filter((consulta) => consulta.length >= 3);
  return Array.from(new Set([...limpias, respaldo.trim().slice(0, 240)])).slice(0, 3);
}

/** Convierte una intención editorial a búsquedas breves para Wikimedia; las referencias sólo orientan, nunca se guardan. */
export async function consultasWikimedia(texto: string, referencias: string[]): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [texto];
  const contenido: any[] = [{
    type: "text",
    text: `Pedido editorial: ${texto}\nDevolvé JSON estricto {"consultas":["..."]} con una a tres búsquedas breves en inglés para Wikimedia Commons. Describí sujeto, luz y atmósfera. No agregues el pilar, no inventes artistas ni copies una obra.`,
  }];
  referencias.forEach((referencia) => contenido.push({ type: "image_url", image_url: { url: referencia, detail: "low" } }));
  const data = await post("/chat/completions", {
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_TEXT_MODEL || "gpt-4o",
    messages: [{ role: "system", content: "Sos director de arte. Proponé búsquedas de obras públicas sin copiar referencias." }, { role: "user", content: contenido }],
    response_format: { type: "json_object" },
    max_tokens: 80,
  });
  const salida = String(data.choices?.[0]?.message?.content || "");
  try { return consultasSeguras(JSON.parse(salida)?.consultas, texto); }
  catch { return [texto]; }
}
