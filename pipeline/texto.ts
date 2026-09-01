/**
 * Cliente de inteligencia editorial.
 *
 * El modo por defecto conserva OpenAI directo. El modo `codex_gateway` habla
 * con `cerebro/server.mjs`, un puente propio que ejecuta Codex autenticado con
 * el inicio de sesión oficial de ChatGPT. Las imágenes no pasan por este
 * cliente: siguen usando `pipeline/openai.ts` y OPENAI_API_KEY.
 */

export type ProveedorTexto = "openai" | "codex_gateway";

export interface ConfiguracionTexto {
  proveedor: ProveedorTexto;
  baseUrl: string;
  apiKey: string;
  modelo: string;
}

function valor(env: NodeJS.ProcessEnv, nombre: string): string | undefined {
  const v = env[nombre]?.trim();
  return v || undefined;
}

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Construye y valida la configuración sin imprimir ni persistir secretos. */
export function configuracionTexto(env: NodeJS.ProcessEnv = process.env): ConfiguracionTexto {
  const solicitado = valor(env, "TEXT_PROVIDER") || "openai";
  if (solicitado !== "openai" && solicitado !== "codex_gateway") {
    throw new Error(`TEXT_PROVIDER inválido: ${solicitado}. Usá openai o codex_gateway.`);
  }

  if (solicitado === "codex_gateway") {
    const baseUrl = valor(env, "CODEX_GATEWAY_URL");
    const apiKey = valor(env, "CODEX_GATEWAY_TOKEN");
    if (!baseUrl) throw new Error("Falta CODEX_GATEWAY_URL para el cerebro Codex.");
    if (!apiKey) throw new Error("Falta CODEX_GATEWAY_TOKEN para el cerebro Codex.");
    return {
      proveedor: "codex_gateway",
      baseUrl: sinBarraFinal(baseUrl),
      apiKey,
      modelo: "hombre-catolico-editorial",
    };
  }

  const apiKey = valor(env, "OPENAI_API_KEY");
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY para texto e imágenes.");
  return {
    proveedor: "openai",
    baseUrl: sinBarraFinal(valor(env, "OPENAI_BASE_URL") || "https://api.openai.com/v1"),
    apiKey,
    modelo: valor(env, "OPENAI_TEXT_MODEL") || "gpt-4o",
  };
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headers(config: ConfiguracionTexto) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
}

async function detalleError(res: Response): Promise<string> {
  return res.text().catch(() => "");
}

async function esperarTrabajoCodex(config: ConfiguracionTexto, id: string): Promise<any> {
  const vence = Date.now() + 180_000;
  while (Date.now() < vence) {
    await espera(1_500);
    const res = await fetch(`${config.baseUrl}/jobs/${encodeURIComponent(id)}`, {
      headers: headers(config),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 202) continue;
    if (!res.ok) {
      const detalle = await detalleError(res);
      throw new Error(`Texto codex_gateway → ${res.status}: ${detalle.slice(0, 400)}`);
    }
    return res.json();
  }
  throw new Error("Texto codex_gateway → tiempo de espera agotado.");
}

async function post(config: ConfiguracionTexto, body: unknown): Promise<any> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 202 && config.proveedor === "codex_gateway") {
    const trabajo = await res.json();
    if (typeof trabajo?.id !== "string" || !trabajo.id) {
      throw new Error("Texto codex_gateway: el cerebro no devolvió un identificador de trabajo.");
    }
    return esperarTrabajoCodex(config, trabajo.id);
  }
  if (!res.ok) {
    const detalle = await detalleError(res);
    throw new Error(`Texto ${config.proveedor} → ${res.status}: ${detalle.slice(0, 400)}`);
  }
  return res.json();
}

/** Envía una instrucción editorial y devuelve sólo el contenido final del modelo. */
export async function chat(system: string, user: string, opts: { json?: boolean; model?: string } = {}): Promise<string> {
  const config = configuracionTexto();
  const body: Record<string, unknown> = {
    model: opts.model || config.modelo,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const data = await post(config, body);
  const contenido = data.choices?.[0]?.message?.content;
  if (typeof contenido !== "string" || !contenido.trim()) {
    throw new Error(`Texto ${config.proveedor}: respuesta sin contenido final.`);
  }
  return contenido;
}
