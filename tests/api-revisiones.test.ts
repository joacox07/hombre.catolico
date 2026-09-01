import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/lotes/[id]/revisiones.ts";
import { crearSesion } from "../api/_lib/auth.js";

const loteId = "2026-W36";
const lote = { id: loteId, piezas: [{ ref: "/data/piezas/pieza-verde.json", fecha_propuesta: "2026-09-01" }] };
const pieza = {
  id: "pieza-verde",
  control_calidad: {
    candados: { citas_literales: true, fuentes_verificadas: true, arte_procedencia: true, render_tecnico: true },
    bloquea_aprobacion: false,
  },
};

function archivo(contenido: unknown, sha = "sha-prueba") {
  return new Response(JSON.stringify({ encoding: "base64", content: Buffer.from(JSON.stringify(contenido)).toString("base64"), sha }), { status: 200 });
}

function respuesta() {
  const out: { status?: number; body?: any } = {};
  return {
    out,
    writeHead(status: number) { out.status = status; },
    end(body: string) { out.body = JSON.parse(body); },
  };
}

function req(body: unknown, cookie = true) {
  const token = crearSesion("secreto-api", Date.now(), 60);
  return {
    method: "POST", query: { id: loteId }, body,
    headers: cookie ? { cookie: `hc_session=${encodeURIComponent(token)}` } : {},
  };
}

function instalarGitHub(simularRevision: "ausente" | "actual", capturar: { put?: any }) {
  const anterior = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const ruta = String(url);
    if (ruta.includes("data/lotes/index.json")) return archivo({ lotes: [{ id: loteId, file: "/data/lotes/lote-2026-W36.json" }] });
    if (ruta.includes("data/lotes/lote-2026-W36.json")) return archivo(lote);
    if (ruta.includes("data/piezas/pieza-verde.json")) return archivo(pieza);
    if (ruta.includes(`data/revisiones/${loteId}.json`)) {
      if (init?.method === "PUT") {
        capturar.put = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ content: { sha: "sha-nueva" } }), { status: 200 });
      }
      if (simularRevision === "ausente") return new Response("", { status: 404 });
      return archivo({ schema: 1, lote_id: loteId, actualizado_en: null, revisiones: {}, eventos: [] }, "sha-actual");
    }
    throw new Error("Ruta GitHub no esperada: " + ruta);
  }) as typeof fetch;
  return () => { globalThis.fetch = anterior; };
}

test("la API exige sesión antes de consultar GitHub", async () => {
  process.env.SESSION_SECRET = "secreto-api";
  const res = respuesta();
  await handler(req({}, false), res as any);
  assert.equal(res.out.status, 401);
});

test("la API valida el cuerpo antes de mutar", async () => {
  process.env.SESSION_SECRET = "secreto-api";
  const res = respuesta();
  await handler(req({ pieza_id: "pieza-verde", decision: "cambios", comentario: "", version: null }), res as any);
  assert.equal(res.out.status, 400);
  assert.match(res.out.body.error, /obligatorio/);
});

test("la API detecta versión obsoleta y no escribe", async () => {
  process.env.SESSION_SECRET = "secreto-api";
  process.env.GITHUB_TOKEN = "token"; process.env.GITHUB_OWNER = "owner"; process.env.GITHUB_REPO = "repo";
  const capturar: { put?: any } = {};
  const restaurar = instalarGitHub("actual", capturar);
  try {
    const res = respuesta();
    await handler(req({ pieza_id: "pieza-verde", decision: "aprobar", comentario: "", version: "sha-vieja" }), res as any);
    assert.equal(res.out.status, 409);
    assert.equal(capturar.put, undefined);
  } finally { restaurar(); }
});

test("la API guarda la revisión versionada y devuelve la nueva versión", async () => {
  process.env.SESSION_SECRET = "secreto-api";
  process.env.GITHUB_TOKEN = "token"; process.env.GITHUB_OWNER = "owner"; process.env.GITHUB_REPO = "repo";
  const capturar: { put?: any } = {};
  const restaurar = instalarGitHub("ausente", capturar);
  try {
    const res = respuesta();
    await handler(req({ pieza_id: "pieza-verde", decision: "aprobar", comentario: "", version: null }), res as any);
    assert.equal(res.out.status, 200);
    assert.equal(res.out.body.version, "sha-nueva");
    const guardado = JSON.parse(Buffer.from(capturar.put.content, "base64").toString("utf8"));
    assert.equal(guardado.revisiones["pieza-verde"].decision, "aprobar");
    assert.equal(guardado.eventos.length, 1);
  } finally { restaurar(); }
});
