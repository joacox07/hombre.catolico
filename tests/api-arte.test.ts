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
