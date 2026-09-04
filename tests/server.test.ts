import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { resolverArchivoSeguro } from "../scripts/server.ts";

test("el servidor estático no sale de su raíz con un traversal", async () => {
  const raiz = resolve("/tmp", "hombre-catolico-sitio");
  assert.equal(resolverArchivoSeguro(raiz, "/../secreto.txt"), null);
  assert.equal(resolverArchivoSeguro(raiz, "/assets/logo.png"), resolve(raiz, "assets/logo.png"));
});
