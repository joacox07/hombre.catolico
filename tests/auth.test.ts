import assert from "node:assert/strict";
import test from "node:test";
import { coincideSecreto, crearSesion, leerSesion } from "../api/_lib/auth.ts";

test("acepta una sesión firmada antes de su vencimiento", () => {
  const ahora = 1_700_000_000_000;
  const token = crearSesion("secreto-de-prueba", ahora, 60);

  assert.equal(leerSesion(token, "secreto-de-prueba", ahora + 30_000), true);
});

test("rechaza una sesión alterada o vencida", () => {
  const ahora = 1_700_000_000_000;
  const token = crearSesion("secreto-de-prueba", ahora, 60);

  assert.equal(leerSesion(token + "x", "secreto-de-prueba", ahora + 30_000), false);
  assert.equal(leerSesion(token, "secreto-de-prueba", ahora + 61 * 60_000), false);
});

test("compara la contraseña sin aceptar valores distintos", () => {
  assert.equal(coincideSecreto("clave correcta", "clave correcta"), true);
  assert.equal(coincideSecreto("clave correcta", "clave-correcta"), false);
});
