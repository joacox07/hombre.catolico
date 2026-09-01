import assert from "node:assert/strict";
import test from "node:test";
import { resolverArte } from "../pipeline/arte.ts";

test("no permite renderizar una pieza final sin un plan de arte", async () => {
  await assert.rejects(
    () => resolverArte({ id: "prueba-sin-arte" }),
    /requiere imagen/,
  );
});
