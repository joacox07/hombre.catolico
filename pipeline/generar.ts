/**
 * El empleado IA — orquestador semanal. Corre en GitHub Actions.
 *   estado → recuperar fichas → redactar (OpenAI o cerebro Codex) → concilio + verificación de citas →
 *   arte (descarga/IA) → render → ensamblar lote → actualizar memoria.
 *
 * CLI:  tsx pipeline/generar.ts [n]   (n = cantidad de piezas, def. 3)
 * Requiere un cerebro de texto y, si se genera arte IA, OPENAI_API_KEY. Nada se publica.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { contextoSemanal } from "./estado.ts";
import { recuperar } from "./recuperacion.ts";
import { verificarCitas } from "./verificar.ts";
import { resolverArte } from "./arte.ts";
import { normalizarPlanArte } from "./arte.ts";
import { ensamblarLote } from "./lote.ts";
import { chat } from "./texto.ts";
import { captionLista } from "./caption.ts";
import { humanizarPieza } from "./voz-humana.ts";
import { direccionAlternativa, normalizarDireccionVisual, validarComposiciones, origenDesdeArte } from "./direccion-visual.ts";
import { crearControlCalidad, registrarRenderEnCalidad } from "./calidad.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leerTxt = (rel: string) => readFile(join(ROOT, rel), "utf8");

/** "YYYY-Www" ISO week de hoy. */
function semanaISO(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Parsea JSON aunque venga envuelto en ```json ... ``` o con texto alrededor. */
function jsonSeguro<T>(s: string, fallback: T): T {
  try {
    const limpio = s.replace(/```json\s*|\s*```/g, "").trim();
    const ini = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");
    return JSON.parse(ini >= 0 && fin > ini ? limpio.slice(ini, fin + 1) : limpio) as T;
  } catch {
    return fallback;
  }
}

function fuentesLegibles(ids: unknown, fichas: Array<{ id: string; titulo_fuente: string }>): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => fichas.find((f) => f.id === id)?.titulo_fuente).filter(Boolean))] as string[];
}

async function systemRedaccion(): Promise<string> {
  const [voz, doctrina, formato, estetica, vozHumana] = await Promise.all([
    leerTxt("manual/01-voz.md"), leerTxt("manual/02-doctrina-y-opinion.md"),
    leerTxt("manual/04-formato-piezas.md"), leerTxt("manual/05-estetica.md"),
    leerTxt("manual/06-voz-humana.md"),
  ]);
  return [
    "Sos el redactor de @hombre.catolico, cuenta católica de formación masculina.",
    "Escribís SOLO apoyándote en las fichas que te paso; NO inventás doctrina ni citas.",
    "Toda cita textual va entre comillas « » y debe existir literal en una ficha.",
    "Seguí estrictamente estos documentos:\n",
    "=== VOZ ===\n" + voz,
    "=== DOCTRINA/OPINIÓN ===\n" + doctrina,
    "=== FORMATO ===\n" + formato,
    "=== ESTÉTICA/ARQUETIPOS ===\n" + estetica,
    "=== VOZ HUMANA (control editorial) ===\n" + vozHumana,
    "",
    "Devolvé SOLO un JSON con esta forma (carrusel):",
    `{ "titulo": "...", "slides": [
       {"tipo":"portada","kicker":"...","titulo":"7-11 palabras","subtitulo":"..."},
       {"tipo":"contenido","kicker":"...","titulo":"...","cuerpo":"... **frase clave en dorado** ...","disposicion":"editorial_superior"|"manifiesto_central"|"bloque_inferior"|"contraste"|"mapa_conceptual","mapa":{"centro":"...","pasos":["...","..."]}},
       {"tipo":"cierre","titulo":"...","cuerpo":"...","fuentes":["Nombre humano de la fuente"],"cta":"..."} ],
     "caption":"...", "fuentes":["idFicha"],
     "clasificacion_doctrinal":[{"afirmacion":"...","nivel":1,"etiqueta":"..."}],
     "revision_humana": false,
     "direccion_visual":{"origen_arte":"obra"|"ia","paleta":"color_obra"|"piedra_fria"|"vino_negro"|"oliva_pergamino"|"calida","composicion_principal":"editorial_superior"|"manifiesto_central"|"bloque_inferior"|"contraste"|"mapa_conceptual"},
     "arte_plan": {
       "modo":"unica"|"recorrida"|"por_slide",
       "principal":{"fuente":"descarga"|"ia"|"curada","autor":"(si descarga)","obra":"(si descarga)","query":"Autor — Obra (si descarga)","prompt":"(si ia)","archivo":"(si curada)"},
       "recortes":["50% 50%"],
       "slides":[{"fuente":"descarga"|"ia"|"curada","autor":"...","obra":"...","query":"Autor — Obra","prompt":"...","archivo":"...","posicion":"50% 50%"}]
     } }`,
    "",
    "REGLA DE COMPOSICIÓN — OBLIGATORIA: cada slide de desarrollo declara disposicion. En un carrusel de 6 desarrollos usá al menos tres disposiciones distintas y nunca repitas una en slides consecutivos.",
    "- editorial_superior: explicación sobria arriba; manifiesto_central: frase/idea breve centrada; bloque_inferior: texto bajo o lateral sobre la obra; contraste: dos polos o una pregunta frente a una respuesta; mapa_conceptual: sólo para causa/consecuencia, proceso o dos caminos.",
    "- mapa_conceptual exige mapa con centro y 2-3 pasos breves conectados. No lo uses sólo para decorar.",
    "- No agregues fuente, número, 'CIC', ni nivel doctrinal a los slides de contenido. La fuente visible aparece SÓLO en el cierre, con nombre humano: 'Catecismo de la Iglesia Católica — castidad y dominio de sí'. Los ids exactos siguen en fuentes y clasificacion_doctrinal para revisión interna.",
    "REGLA DE IMAGEN (arte_plan) — OBLIGATORIA en cada pieza. La imagen debe reforzar el mensaje, no ser al azar.",
    "Elegí deliberadamente UNO de estos modos:",
    "- recorrida: UNA obra coherente recorrida con crops distintos. Entregá principal y EXACTAMENTE un recorte 'X% Y%' por slide; el último debe ser '50% 50%' para mostrar la obra completa.",
    "- por_slide: una imagen distinta, coherente y con intención en cada slide. Entregá EXACTAMENTE un plan por slide; usá obras públicas descargables siempre que puedas y como máximo UNA imagen IA por pieza.",
    "- unica: una sola obra sostenida únicamente cuando el texto sea el protagonista. Entregá principal.",
    "Nunca dejes el arte vacío ni propongas un fondo abstracto, degradado o procedural.",
    "- Si el tema tiene un santo real, una escena bíblica/histórica o una obra famosa →",
    "  fuente:'descarga' con `query` en INGLÉS, con AUTOR + OBRA concretos (da mejores resultados):",
    "  ej. 'Georges de La Tour Saint Joseph the carpenter', 'Rembrandt apostle Paul', 'Caravaggio Saint Jerome writing',",
    "  'Guido Reni Saint Michael archangel', 'El Greco Christ'.",
    "- Para descarga, declarás autor y obra concretos; query debe ser exactamente 'Autor — Obra'. La descarga se acepta sólo si devuelve procedencia, licencia, autor y título verificables.",
    "- Si el tema es una virtud o idea abstracta sin obra obvia → fuente:'ia' con `prompt` de una",
    "  ESCENA ATMOSFÉRICA simbólica y coherente con el tema (ej. trabajo: 'un carpintero trabajando la",
    "  madera a la luz de una vela'; oración: 'un hombre arrodillado en una capilla en penumbra';",
    "  fortaleza: 'un soldado medieval en oración antes de la batalla'), SIN santos identificables y SIN texto. No uses por defecto un hombre solo, una vela, paleta tabaco/dorado ni claroscuro cálido.",
    "- Elegí paleta según el arte: color_obra conserva la pintura; piedra_fria para claridad, examen o distancia; vino_negro para combate serio; oliva_pergamino para sabiduría y madurez; calida sólo cuando la luz del tema realmente lo pide.",
    "- El `titulo` de portada y el fondo tienen que 'conversar': elegí una imagen que haga sentido con el gancho.",
    "",
    "REGLA DE CAPTION — OBLIGATORIA en cada pieza:",
    "- Escribí en español, listo para copiar y pegar en Instagram.",
    "- Abrí con un gancho breve; desarrollá la idea en 1-2 párrafos claros, fieles a las fichas.",
    "- Cerrá con UN CTA orgánico y variable: guardar, compartir o comentar. No prometas envíos, recursos, mensajes privados ni automatizaciones.",
    "- Terminá con una línea separada de 3 a 5 hashtags en español, específicos al tema y sin hashtags genéricos de relleno.",
    "- Si nombrás una fuente en la caption, usá sólo su nombre humano ('Catecismo de la Iglesia Católica'), nunca código, número ni nivel doctrinal.",
    "- No agregues citas textuales, datos ni afirmaciones doctrinales que no estén respaldados por las fichas.",
  ].join("\n");
}

async function main() {
  const n = Number(process.argv[2] || 3);
  const ctx = await contextoSemanal(n);
  if (ctx.sugerencia.length < n) {
    throw new Error(`Sólo hay ${ctx.sugerencia.length} temas con fichas asociadas para una tanda de ${n}; no se crea un lote parcial.`);
  }
  const semana = semanaISO();
  const corrida = process.env.LOTE_ID || undefined;
  const [sys, concilio, vozHumana] = await Promise.all([
    systemRedaccion(), leerTxt(".claude/skills/revisor-sacerdote/SKILL.md"), leerTxt("manual/06-voz-humana.md"),
  ]);

  await mkdir(join(ROOT, "data", "piezas"), { recursive: true });
  const specPiezas: Array<{ ref: string; fecha_propuesta: string; estado: string; revisor: unknown }> = [];
  const rutas: string[] = [];
  // Acumula las direcciones aceptadas en esta misma corrida: la regla de no
  // repetir no puede depender sólo del historial ya escrito en el registro.
  const direccionesDelLote: Array<{ paleta: string; composicion_principal: string }> = [];
  let dia = 2; // fechas propuestas escalonadas (mié/vie/dom orientativo)

  for (const [indice, { tema }] of ctx.sugerencia.entries()) {
    try {
      console.log(`\n▶ ${tema.id} — ${tema.titulo}`);
      const fichas = (await recuperar([tema.id]))[tema.id];
      if (!fichas.length) {
        console.warn(`  ↷ ${tema.id} se omite: no hay fichas verificables asociadas (no se genera arte ni borrador).`);
        continue;
      }

      // 1. Redacción anclada
      const userRedaccion = `TEMA: ${tema.titulo} (pilar ${tema.pilar}, formato ${tema.formato}, ${tema.sensible ? "SENSIBLE" : "normal"}).\n` +
        `FICHAS DISPONIBLES (única fuente citable):\n${JSON.stringify(fichas, null, 2)}`;
      const cuotaArte = ctx.cuotas_origen_arte[indice] || "obra";
      const direccionesAExcluir = [...ctx.direcciones_recientes, ...direccionesDelLote];
      const recientes = direccionesAExcluir.map((d) => `${d.paleta}/${d.composicion_principal}`).join(", ") || "ninguna";
      const instruccionVisual = `\n\nCUOTA OBLIGATORIA DE ARTE PARA ESTA PIEZA: ${cuotaArte}. ` +
        (cuotaArte === "obra" ? "arte_plan debe usar descarga o curada, no IA." : "arte_plan debe usar IA, no descarga/curada.") +
        `\nDIRECCIONES RECIENTES A EVITAR: ${recientes}. No repitas su paleta ni su composicion_principal.`;
      let contenido: any = null;
      let ultimoError = "";
      for (let intento = 0; intento < 3; intento++) {
        const pedido = intento === 0 ? userRedaccion + instruccionVisual : userRedaccion + instruccionVisual + `\n\nLa propuesta anterior falló esta validación: ${ultimoError}. Corregila y devolvé sólo JSON válido.`;
        const candidato = jsonSeguro<any>(await chat(sys, pedido, { json: true }), null);
        try {
          if (!candidato || !Array.isArray(candidato.slides) || !captionLista(candidato.caption)) {
            throw new Error("faltan slides o caption válida");
          }
          if (/\b(?:CIC|nivel\s*\d)\b/i.test(candidato.caption)) {
            throw new Error("la caption no debe mostrar códigos ni niveles doctrinales");
          }
          let direccion = normalizarDireccionVisual(candidato.direccion_visual);
          if (direccion.origen_arte !== cuotaArte) throw new Error(`origen_arte debe ser ${cuotaArte}`);
          normalizarPlanArte(candidato.arte_plan, candidato.slides.length);
          if (origenDesdeArte(candidato.arte_plan) !== cuotaArte) throw new Error(`arte_plan debe materializar ${cuotaArte}`);
          if (direccionesAExcluir.some((d) => d.paleta === direccion.paleta || d.composicion_principal === direccion.composicion_principal)) {
            direccion = direccionAlternativa(candidato.slides, direccion, direccionesAExcluir) || direccion;
            candidato.direccion_visual = direccion;
          }
          if (direccionesAExcluir.some((d) => d.paleta === direccion.paleta || d.composicion_principal === direccion.composicion_principal)) {
            throw new Error("paleta o composición principal repetida respecto de los dos posts anteriores o de esta misma tanda");
          }
          validarComposiciones(candidato.slides, direccion);
          contenido = await humanizarPieza(candidato, vozHumana);
          if (!captionLista(contenido.caption)) throw new Error("la revisión de voz dejó una caption inválida");
          break;
        } catch (error) {
          ultimoError = String(error).replace(/^Error:\s*/, "").slice(0, 260);
        }
      }
      if (!contenido) throw new Error(`el modelo no devolvió una pieza visual válida: ${ultimoError}`);
      const pieza: any = { id: tema.id, tema: tema.titulo, pilar: tema.pilar, tipo: tema.formato, santos: tema.santos, nivel: tema.nivel, ...contenido };
      // Las referencias exactas quedan en la ficha y clasificación, no en el arte público.
      pieza.slides.filter((slide: any) => slide.tipo === "contenido").forEach((slide: any) => delete slide.fuente);
      const cierre = pieza.slides.find((slide: any) => slide.tipo === "cierre");
      if (cierre) cierre.fuentes = fuentesLegibles(pieza.fuentes, fichas);

      // 2. Concilio (criterio) + 3. verificación de citas (determinista)
      const veredicto = jsonSeguro<any>(await chat(
        concilio + "\n\nDevolvé SOLO el JSON del veredicto.",
        `PIEZA:\n${JSON.stringify(pieza)}\n\nFICHAS:\n${JSON.stringify(fichas)}`,
        { json: true },
      ), {});
      const chequeo = verificarCitas(pieza, fichas);
      const revisor = {
        veredicto: veredicto.veredicto || "revision_humana",
        citas_verificadas: chequeo.ok,
        requiere_revision_humana: tema.sensible || !chequeo.ok || veredicto.requiere_revision_humana === true,
        nota: veredicto.nota || "",
        citas: chequeo.citas,
      };

      // 4. Arte (descarga PD o IA) — una pieza final nunca se reemplaza por un gradiente.
      // Si el arte falla, el catch externo omite la pieza y deja el error visible en la corrida.
      await resolverArte(pieza);
      pieza.control_calidad = await crearControlCalidad(pieza, fichas, { sensible: tema.sensible });
      direccionesDelLote.push(pieza.direccion_visual);

      // 5. Guardar pieza
      const ref = `/data/piezas/${tema.id}.json`;
      await writeFile(join(ROOT, ref.slice(1)), JSON.stringify(pieza, null, 2) + "\n");
      rutas.push(join(ROOT, ref.slice(1)));
      const fp = new Date(); fp.setDate(fp.getDate() + dia);
      specPiezas.push({ ref, fecha_propuesta: `${fp.toISOString().slice(0, 10)} 20:00`, estado: "en_revision", revisor });
      dia += 2;
    } catch (e) {
      console.error(`  ✗ ${tema.id} falló: ${String(e).slice(0, 200)} — se omite y sigue.`);
    }
  }

  if (specPiezas.length !== n) {
    throw new Error(`Se generaron ${specPiezas.length} de ${n} piezas; no se crea un lote parcial. Revisá el cerebro editorial y reintentá la tanda.`);
  }

  // 6. Render de todas las piezas
  console.log("\n▶ render…");
  execFileSync("npx", ["tsx", "scripts/render.ts", ...rutas], { cwd: ROOT, stdio: "inherit" });

  // El renderer escribe un informe por pieza. Sin informe verde no se ensambla el lote.
  for (const ruta of rutas) {
    const pieza = JSON.parse(await readFile(ruta, "utf8"));
    const informeRuta = join(ROOT, "out", pieza.id, "qa.json");
    const informe = JSON.parse(await readFile(informeRuta, "utf8"));
    pieza.control_calidad = registrarRenderEnCalidad(
      pieza.control_calidad,
      informe.ok === true,
      Array.isArray(informe.errores) ? informe.errores.join(" ") : undefined,
    );
    if (!informe.ok) throw new Error(`El render técnico falló para ${pieza.id}.`);
    await writeFile(ruta, JSON.stringify(pieza, null, 2) + "\n");
  }

  // 7. Ensamblar lote + memoria
  const file = await ensamblarLote({ semana, id: corrida, nombre: `Lote ${semana}`, piezas: specPiezas as any });
  console.log(`\n✓ Lote listo: ${file} · ${specPiezas.length} piezas · nada publicado (revisá en el panel).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
