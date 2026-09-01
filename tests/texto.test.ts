import assert from "node:assert/strict";
import test from "node:test";
import { configuracionTexto, esErrorDeRelay } from "../pipeline/texto.ts";

test("mantiene OpenAI como respaldo por defecto", () => {
  assert.deepEqual(configuracionTexto({ OPENAI_API_KEY: "prueba" }), {
    proveedor: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "prueba",
    modelo: "gpt-4o",
  });
});

test("usa el gateway propio de Codex sólo para texto", () => {
  assert.deepEqual(configuracionTexto({
    TEXT_PROVIDER: "codex_gateway",
    CODEX_GATEWAY_URL: "https://cerebro.example.com/v1/",
    CODEX_GATEWAY_TOKEN: "secreto-de-prueba",
    OPENAI_API_KEY: "solo-imagenes",
  }), {
    proveedor: "codex_gateway",
    baseUrl: "https://cerebro.example.com/v1",
    apiKey: "secreto-de-prueba",
    modelo: "hombre-catolico-editorial",
  });
});

test("el gateway exige una URL y un secreto propios", () => {
  assert.throws(
    () => configuracionTexto({ TEXT_PROVIDER: "codex_gateway", CODEX_GATEWAY_URL: "https://cerebro.example.com/v1" }),
    /CODEX_GATEWAY_TOKEN/,
  );
});

test("el gateway conserva una ruta de trabajos compatible con su base URL", () => {
  const config = configuracionTexto({
    TEXT_PROVIDER: "codex_gateway",
    CODEX_GATEWAY_URL: "https://cerebro.example.com/v1/",
    CODEX_GATEWAY_TOKEN: "secreto-de-prueba",
  });
  assert.equal(`${config.baseUrl}/jobs/job_prueba`, "https://cerebro.example.com/v1/jobs/job_prueba");
});

test("reintenta el cerebro cuando el relay temporal ya no existe", () => {
  assert.equal(esErrorDeRelay("Texto codex_gateway → 503: <h1>no tunnel here :(</h1>"), true);
  assert.equal(esErrorDeRelay("Texto openai → 429"), false);
});
