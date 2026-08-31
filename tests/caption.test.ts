import assert from "node:assert/strict";
import test from "node:test";
import { captionLista } from "../pipeline/caption.ts";

test("acepta una descripción lista para Instagram", () => {
  const caption = "La fortaleza se ejercita en lo ordinario, cuando nadie mira. Guardá esta reflexión para volver a ella durante la semana.\n\n#fe #virtud #hombrecatolico";
  assert.equal(captionLista(caption), true);
});

test("rechaza una descripción ausente o sin hashtags suficientes", () => {
  assert.equal(captionLista(""), false);
  assert.equal(captionLista("Una idea breve para compartir.\n\n#fe #virtud"), false);
});
