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

/** Genera una imagen con gpt-image-1. Devuelve el PNG como Buffer. */
export async function imagen(prompt: string, opts: { size?: string; quality?: string; model?: string } = {}): Promise<Buffer> {
  const data = await post("/images/generations", {
    model: opts.model || process.env.IMAGEN_MODEL || "gpt-image-1",
    prompt,
    size: opts.size || process.env.IMAGEN_SIZE || "1024x1536",
    quality: opts.quality || process.env.IMAGEN_QUALITY || "high",
    n: 1,
  });
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI images: respuesta sin b64_json");
  return Buffer.from(b64, "base64");
}
