import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buscarObrasPublicas, buscarObrasPublicasPorConsultas } from "../pipeline/arte-descarga.ts";
import { artePendienteDeRender, referenciasValidas, validarSolicitudArte } from "../api/_lib/arte-editorial.ts";
import { consultasWikimedia } from "../pipeline/openai.ts";
import { consultasEditorialesBase } from "../pipeline/perfil-visual.ts";

const referencia = "data:image/png;base64,aGVsbG8=";

test("la búsqueda conserva sólo obras reutilizables y no IA", async () => {
  const anterior = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ query: { pages: {
    1: { pageid: 1, title: "Obra pública", categories: [], imageinfo: [{ thumburl: "https://img/1", descriptionurl: "https://commons/1", extmetadata: { ObjectName: { value: "Obra pública" }, LicenseShortName: { value: "Public domain" } } }] },
    2: { pageid: 2, title: "Imagen IA", categories: [{ title: "AI generated" }], imageinfo: [{ thumburl: "https://img/2", extmetadata: { LicenseShortName: { value: "CC BY" } } }] },
    3: { pageid: 3, title: "No comercial", categories: [], imageinfo: [{ thumburl: "https://img/3", extmetadata: { LicenseShortName: { value: "CC BY-NC" } } }] },
  } } }), { status: 200 })) as typeof fetch;
  try {
    const obras = await buscarObrasPublicas("luz de vela");
    assert.equal(obras.length, 1);
    assert.equal(obras[0].titulo, "Obra pública");
  } finally { globalThis.fetch = anterior; }
});

test("la búsqueda por consultas alternativas no repite una misma obra", async () => {
  const anterior = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ query: { pages: {
    1: { pageid: 1, title: "Obra pública", categories: [], imageinfo: [{ thumburl: "https://img/1", descriptionurl: "https://commons/1", extmetadata: { ObjectName: { value: "Obra pública" }, LicenseShortName: { value: "CC BY" } } }] },
  } } }), { status: 200 })) as typeof fetch;
  try {
    const obras = await buscarObrasPublicasPorConsultas(["candlelit carpenter", "carpenter at night"]);
    assert.equal(obras.length, 1);
    assert.equal(obras[0].id, "1");
  } finally { globalThis.fetch = anterior; }
});

test("la intención en español se normaliza a búsquedas breves sin pilar agregado", async () => {
  const fetchAnterior = globalThis.fetch;
  const keyAnterior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "prueba";
  globalThis.fetch = (async (_url, opciones: any) => {
    const cuerpo = JSON.parse(opciones.body);
    assert.match(cuerpo.messages[1].content[0].text, /hombre trabajando madera/);
    assert.doesNotMatch(cuerpo.messages[1].content[0].text, /Fortaleza/);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"consultas":["candlelit carpenter","quiet woodworking workshop"]}' } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await consultasWikimedia("hombre trabajando madera a la luz de vela", []), ["candlelit carpenter", "quiet woodworking workshop", "hombre trabajando madera a la luz de vela classical painting", "hombre trabajando madera a la luz de vela historical religious art"]);
  } finally {
    globalThis.fetch = fetchAnterior;
    if (keyAnterior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = keyAnterior;
  }
});

test("una búsqueda genérica se enriquece con escenas católicas y no queda literal", () => {
  const consultas = consultasEditorialesBase({ consulta: "Sacerdote", destino: "post", titulo: "Discernir acompañado", caption: "Un sacerdote ayuda a discernir." });
  assert.deepEqual(consultas, [
    "Catholic confession painting",
    "priest spiritual direction classical painting",
    "Catholic priest at altar painting",
  ]);
});

test("las intenciones editoriales frecuentes generan búsquedas específicas", () => {
  const casos: Array<[string, string]> = [
    ["San José trabajador", "Saint Joseph carpenter"],
    ["Padre enseñando a rezar a su hijo", "father teaching son prayer"],
    ["Confesión", "Catholic confession"],
    ["Virtud de la templanza", "man praying"],
    ["Matrimonio católico", "Christian marriage"],
    ["Hombre rezando antes de tomar una decisión", "man praying"],
    ["Sacerdote celebrando la Misa", "Catholic priest at altar painting"],
  ];
  for (const [consulta, esperada] of casos) {
    const consultas = consultasEditorialesBase({ consulta, destino: "post" });
    assert.ok(consultas.some((valor) => valor.includes(esperada)), `${consulta} debería incluir ${esperada}`);
  }
});

test("descarta documentos escaneados y ordena una obra apta por puntaje editorial", async () => {
  const anterior = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ query: { pages: {
    1: { pageid: 1, title: "Catholic Encyclopedia, volume 9.djvu", categories: [], imageinfo: [{ thumburl: "https://img/1", mime: "image/jpeg", width: 900, height: 1300, extmetadata: { LicenseShortName: { value: "Public domain" } } }] },
    2: { pageid: 2, title: "Catholic priest at altar, oil painting", categories: [{ title: "Paintings of Catholic Mass" }], imageinfo: [{ thumburl: "https://img/2", mime: "image/jpeg", width: 1800, height: 2400, extmetadata: { ObjectName: { value: "Catholic priest at altar" }, LicenseShortName: { value: "Public domain" }, DateTimeOriginal: { value: "1884" } } }] },
  } } }), { status: 200 })) as typeof fetch;
  try {
    const obras = await buscarObrasPublicas("Catholic priest celebrating Mass oil painting", 12, { destino: "post", texto: "sacerdote misa altar" });
    assert.equal(obras.length, 1);
    assert.equal(obras[0].titulo, "Catholic priest at altar");
    assert.equal(obras[0].orientacion, "vertical");
    assert.equal(obras[0].periodo, "1884");
    assert.ok(obras[0].puntuacion >= 70);
  } finally { globalThis.fetch = anterior; }
});

test("la solicitud limita referencias y exige confirmación de derechos", () => {
  assert.throws(() => referenciasValidas([referencia, referencia, referencia, referencia]), /hasta tres/);
  assert.throws(() => validarSolicitudArte({ lote_id: "2026-W36", pieza_id: "pieza", destino: "post", consulta: "luz", referencias: [referencia] }), /Confirmá/);
  assert.equal(validarSolicitudArte({ lote_id: "2026-W36", pieza_id: "pieza", destino: "reel", consulta: "luz", referencias: [referencia], derechos_referencias: true }).destino, "reel");
  const pesada = `data:image/png;base64,${Buffer.alloc(400_001).toString("base64")}`;
  assert.throws(() => referenciasValidas([pesada]), /400 KB/);
});

test("un cambio de arte vuelve a exigir render", () => {
  const pieza: any = { control_calidad: { candados: { arte_procedencia: false, render_tecnico: true }, alertas: [], bloquea_aprobacion: false } };
  artePendienteDeRender(pieza);
  assert.equal(pieza.control_calidad.candados.arte_procedencia, true);
  assert.equal(pieza.control_calidad.candados.render_tecnico, "pendiente");
  assert.equal(pieza.control_calidad.bloquea_aprobacion, true);
});

test("la portada Reel usa la misma capa editorial y no inyecta texto sin escapar", () => {
  const scope: any = { globalThis: {} };
  vm.runInNewContext(readFileSync(new URL("../templates/render.js", import.meta.url), "utf8"), scope);
  const html = scope.globalThis.HC.reelHTML({ tema: "Tema", direccion_visual: { paleta: "calida" }, reel_portada: { titulo: "<seguro>", arte: {} } });
  assert.match(html, /arq-a reel-portada/);
  assert.match(html, /&lt;seguro&gt;/);
});
