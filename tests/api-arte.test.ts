import assert from "node:assert/strict";
import test from "node:test";
import buscar from "../api/arte/buscar.ts";
import generar from "../api/arte/generar.ts";
import aplicar from "../api/arte/aplicar.ts";
import { crearSesion } from "../api/_lib/auth.js";

function respuesta() {
  const out: { status?: number; body?: any } = {};
  return { out, writeHead(status: number) { out.status = status; }, end(body: string) { out.body = JSON.parse(body); } };
}

function req(body: unknown, conSesion = false) {
  const cookie = conSesion ? `hc_session=${encodeURIComponent(crearSesion("secreto-arte", Date.now(), 60))}` : "";
  return { method: "POST", body, headers: cookie ? { cookie } : {} };
}

test("las tres rutas de arte exigen sesión antes de llamar servicios externos", async () => {
  process.env.SESSION_SECRET = "secreto-arte";
  for (const handler of [buscar, generar, aplicar]) {
    const res = respuesta();
    await handler(req({}), res as any);
    assert.equal(res.out.status, 401);
  }
});

test("las rutas rechazan solicitudes incompletas sin consultar GitHub", async () => {
  process.env.SESSION_SECRET = "secreto-arte";
  for (const handler of [buscar, generar, aplicar]) {
    const res = respuesta();
    await handler(req({ lote_id: "malo", pieza_id: "x", destino: "post", consulta: "luz" }, true), res as any);
    assert.equal(res.out.status, 400);
  }
});

test("generar guarda y dispara render sin devolver la imagen al navegador", async () => {
  const anteriorFetch = globalThis.fetch;
  const anteriorEnv = { ...process.env };
  const contenido = (valor: unknown, sha = "sha-lectura") => ({ encoding: "base64", content: Buffer.from(JSON.stringify(valor)).toString("base64"), sha });
  const escrituras: string[] = [];
  process.env.SESSION_SECRET = "secreto-arte";
  process.env.OPENAI_API_KEY = "prueba";
  process.env.GITHUB_TOKEN = "prueba";
  process.env.GITHUB_OWNER = "dueno";
  process.env.GITHUB_REPO = "repo";
  process.env.GITHUB_BRANCH = "rama";
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const ruta = String(url);
    const metodo = init?.method || "GET";
    if (ruta.includes("api.openai.com/v1/images/generations")) {
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-propia").toString("base64") }] }), { status: 200 });
    }
    if (ruta.includes("/contents/data/lotes/index.json")) return new Response(JSON.stringify(contenido({ lotes: [{ id: "2026-W36", file: "data/lotes/lote.json" }] })), { status: 200 });
    if (ruta.includes("/contents/data/lotes/lote.json")) return new Response(JSON.stringify(contenido({ piezas: [{ ref: "data/piezas/pieza.json" }] })), { status: 200 });
    if (ruta.includes("/contents/data/piezas/pieza.json") && metodo === "GET") return new Response(JSON.stringify(contenido({ id: "pieza", tema: "Trabajo sobrio", santos: [], slides: [] })), { status: 200 });
    if (ruta.includes("/contents/data/revisiones/")) return new Response("", { status: 404 });
    if (ruta.includes("/contents/") && metodo === "PUT") {
      escrituras.push(ruta);
      return new Response(JSON.stringify({ content: { sha: `sha-${escrituras.length}` } }), { status: 200 });
    }
    if (ruta.includes("/actions/workflows/arte-editorial.yml/dispatches")) return new Response(null, { status: 204 });
    throw new Error(`Ruta no esperada: ${metodo} ${ruta}`);
  }) as typeof fetch;
  try {
    const res = respuesta();
    await generar(req({ lote_id: "2026-W36", pieza_id: "pieza", destino: "post", consulta: "hombre trabajando", referencias: [], derechos_referencias: false }, true), res as any);
    assert.equal(res.out.status, 202);
    assert.equal(res.out.body.estado, "renderizando");
    assert.equal("candidato" in res.out.body, false);
    assert.equal("image_data" in res.out.body, false);
    assert.equal(escrituras.length, 3);
  } finally {
    globalThis.fetch = anteriorFetch;
    for (const clave of Object.keys(process.env)) if (!(clave in anteriorEnv)) delete process.env[clave];
    Object.assign(process.env, anteriorEnv);
  }
});
