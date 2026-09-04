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

test("buscar usa el contexto de la pieza, filtra documentos y entrega metadatos editoriales", async () => {
  const anteriorFetch = globalThis.fetch;
  const anteriorEnv = { ...process.env };
  const contenido = (valor: unknown, sha = "sha-lectura") => ({ encoding: "base64", content: Buffer.from(JSON.stringify(valor)).toString("base64"), sha });
  const consultas: string[] = [];
  process.env.SESSION_SECRET = "secreto-arte";
  process.env.GITHUB_TOKEN = "prueba"; process.env.GITHUB_OWNER = "dueno"; process.env.GITHUB_REPO = "repo";
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = (async (url: string | URL) => {
    const ruta = String(url);
    if (ruta.includes("data/lotes/index.json")) return new Response(JSON.stringify(contenido({ lotes: [{ id: "2026-W36", file: "data/lotes/lote.json" }] })), { status: 200 });
    if (ruta.includes("data/lotes/lote.json")) return new Response(JSON.stringify(contenido({ piezas: [{ ref: "data/piezas/pieza.json" }] })), { status: 200 });
    if (ruta.includes("data/piezas/pieza.json")) return new Response(JSON.stringify(contenido({ id: "pieza", tema: "Discernir acompañado", titulo: "Un sacerdote para discernir", caption: "La oración pide acompañamiento.", santos: [], slides: [] })), { status: 200 });
    if (ruta.includes("data/revisiones/")) return new Response("", { status: 404 });
    if (ruta.includes("commons.wikimedia.org")) {
      consultas.push(decodeURIComponent(new URL(ruta).searchParams.get("gsrsearch") || ""));
      return new Response(JSON.stringify({ query: { pages: {
        1: { pageid: 1, title: "Catholic Encyclopedia.pdf", categories: [], imageinfo: [{ thumburl: "https://img/1", mime: "image/jpeg", extmetadata: { LicenseShortName: { value: "Public domain" } } }] },
        2: { pageid: 2, title: "Catholic priest praying in church painting", categories: [{ title: "Religious paintings" }], imageinfo: [{ thumburl: "https://img/2", mime: "image/jpeg", width: 1800, height: 2400, descriptionurl: "https://commons/2", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, ObjectName: { value: "Catholic priest praying" } } }] },
      } } }), { status: 200 });
    }
    throw new Error(`Ruta no esperada: ${ruta}`);
  }) as typeof fetch;
  try {
    const res = respuesta();
    await buscar(req({ lote_id: "2026-W36", pieza_id: "pieza", destino: "post", consulta: "Sacerdote", referencias: [], filtros: { licencia: "todas", orientacion: "vertical", tipo: "todos", alta_resolucion: true } }, true), res as any);
    assert.equal(res.out.status, 200);
    assert.ok(consultas.length >= 1);
    assert.match(consultas[0], /Catholic confession/i);
    assert.equal(res.out.body.candidatos.length, 1);
    assert.equal(res.out.body.candidatos[0].fuente, "Wikimedia Commons");
    assert.equal(res.out.body.candidatos[0].orientacion, "vertical");
  } finally {
    globalThis.fetch = anteriorFetch;
    for (const clave of Object.keys(process.env)) if (!(clave in anteriorEnv)) delete process.env[clave];
    Object.assign(process.env, anteriorEnv);
  }
});

test("buscar traduce un fallo de red de Commons sin exponer el mensaje nativo", async () => {
  const anteriorFetch = globalThis.fetch;
  const anteriorEnv = { ...process.env };
  const contenido = (valor: unknown, sha = "sha-lectura") => ({ encoding: "base64", content: Buffer.from(JSON.stringify(valor)).toString("base64"), sha });
  process.env.SESSION_SECRET = "secreto-arte";
  process.env.GITHUB_TOKEN = "prueba"; process.env.GITHUB_OWNER = "dueno"; process.env.GITHUB_REPO = "repo";
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = (async (url: string | URL) => {
    const ruta = String(url);
    if (ruta.includes("data/lotes/index.json")) return new Response(JSON.stringify(contenido({ lotes: [{ id: "2026-W36", file: "data/lotes/lote.json" }] })), { status: 200 });
    if (ruta.includes("data/lotes/lote.json")) return new Response(JSON.stringify(contenido({ piezas: [{ ref: "data/piezas/pieza.json" }] })), { status: 200 });
    if (ruta.includes("data/piezas/pieza.json")) return new Response(JSON.stringify(contenido({ id: "pieza", tema: "Discernir acompañado", slides: [] })), { status: 200 });
    if (ruta.includes("data/revisiones/")) return new Response("", { status: 404 });
    if (ruta.includes("commons.wikimedia.org")) throw new TypeError("Load failed");
    throw new Error(`Ruta no esperada: ${ruta}`);
  }) as typeof fetch;
  try {
    const res = respuesta();
    await buscar(req({ lote_id: "2026-W36", pieza_id: "pieza", destino: "post", consulta: "Sacerdote", referencias: [] }, true), res as any);
    assert.equal(res.out.status, 503);
    assert.equal(res.out.body.error, "No pudimos conectarnos con la fuente de imágenes. Reintentá en unos segundos.");
    assert.doesNotMatch(res.out.body.error, /Load failed/i);
  } finally {
    globalThis.fetch = anteriorFetch;
    for (const clave of Object.keys(process.env)) if (!(clave in anteriorEnv)) delete process.env[clave];
    Object.assign(process.env, anteriorEnv);
  }
});
