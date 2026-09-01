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
import { ensamblarLote } from "./lote.ts";
import { chat } from "./texto.ts";
import { captionLista } from "./caption.ts";

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

async function systemRedaccion(): Promise<string> {
  const [voz, doctrina, formato, estetica] = await Promise.all([
    leerTxt("manual/01-voz.md"), leerTxt("manual/02-doctrina-y-opinion.md"),
    leerTxt("manual/04-formato-piezas.md"), leerTxt("manual/05-estetica.md"),
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
    "",
    "Devolvé SOLO un JSON con esta forma (carrusel):",
    `{ "titulo": "...", "slides": [
       {"tipo":"portada","kicker":"...","titulo":"7-11 palabras","subtitulo":"..."},
       {"tipo":"contenido","kicker":"...","titulo":"...","cuerpo":"... **frase clave en dorado** ...","fuente":"Ref · Nivel"},
       {"tipo":"cierre","titulo":"...","cuerpo":"...","fuentes":["Ref · Nivel"],"cta":"..."} ],
     "caption":"...", "fuentes":["idFicha"],
     "clasificacion_doctrinal":[{"afirmacion":"...","nivel":1,"etiqueta":"..."}],
     "revision_humana": false,
     "arte_plan": { "fuente":"descarga"|"ia", "query":"(si descarga)", "prompt":"(si ia)" } }`,
    "",
    "REGLA DE IMAGEN (arte_plan) — OBLIGATORIA en cada pieza. Pensá con criterio qué imagen",
    "acompaña mejor a ESTE tema; la imagen debe reforzar el mensaje, no ser al azar:",
    "- Si el tema tiene un santo real, una escena bíblica/histórica o una obra famosa →",
    "  fuente:'descarga' con `query` en INGLÉS, con AUTOR + OBRA concretos (da mejores resultados):",
    "  ej. 'Georges de La Tour Saint Joseph the carpenter', 'Rembrandt apostle Paul', 'Caravaggio Saint Jerome writing',",
    "  'Guido Reni Saint Michael archangel', 'El Greco Christ'.",
    "- Si el tema es una virtud o idea abstracta sin obra obvia → fuente:'ia' con `prompt` de una",
    "  ESCENA ATMOSFÉRICA simbólica y coherente con el tema (ej. trabajo: 'un carpintero trabajando la",
    "  madera a la luz de una vela'; oración: 'un hombre arrodillado en una capilla en penumbra';",
    "  fortaleza: 'un soldado medieval en oración antes de la batalla'), SIN santos identificables y SIN texto.",
    "- El `titulo` de portada y el fondo tienen que 'conversar': elegí una imagen que haga sentido con el gancho.",
    "",
    "REGLA DE CAPTION — OBLIGATORIA en cada pieza:",
    "- Escribí en español, listo para copiar y pegar en Instagram.",
    "- Abrí con un gancho breve; desarrollá la idea en 1-2 párrafos claros, fieles a las fichas.",
    "- Cerrá con UN CTA orgánico y variable: guardar, compartir o comentar. No prometas envíos, recursos, mensajes privados ni automatizaciones.",
    "- Terminá con una línea separada de 3 a 5 hashtags en español, específicos al tema y sin hashtags genéricos de relleno.",
    "- No agregues citas textuales, datos ni afirmaciones doctrinales que no estén respaldados por las fichas.",
  ].join("\n");
}

async function main() {
  const n = Number(process.argv[2] || 3);
  const ctx = await contextoSemanal(n);
  if (ctx.sugerencia.length === 0) throw new Error("No hay temas candidatos en el backlog.");
  const semana = semanaISO();
  const corrida = process.env.LOTE_ID || undefined;
  const sys = await systemRedaccion();
  const concilio = await leerTxt(".claude/skills/revisor-sacerdote/SKILL.md");

  await mkdir(join(ROOT, "data", "piezas"), { recursive: true });
  const specPiezas: Array<{ ref: string; fecha_propuesta: string; estado: string; revisor: unknown }> = [];
  const rutas: string[] = [];
  let dia = 2; // fechas propuestas escalonadas (mié/vie/dom orientativo)

  for (const { tema } of ctx.sugerencia) {
    try {
      console.log(`\n▶ ${tema.id} — ${tema.titulo}`);
      const fichas = (await recuperar([tema.id]))[tema.id];

      // 1. Redacción anclada
      const userRedaccion = `TEMA: ${tema.titulo} (pilar ${tema.pilar}, formato ${tema.formato}, ${tema.sensible ? "SENSIBLE" : "normal"}).\n` +
        `FICHAS DISPONIBLES (única fuente citable):\n${JSON.stringify(fichas, null, 2)}`;
      let contenido: any = null;
      for (let intento = 0; intento < 2; intento++) {
        const pedido = intento === 0 ? userRedaccion : userRedaccion + "\n\nLa respuesta anterior no incluyó una caption válida. Reintentá y cumplí exactamente la regla de caption.";
        const candidato = jsonSeguro<any>(await chat(sys, pedido, { json: true }), null);
        if (candidato && Array.isArray(candidato.slides) && captionLista(candidato.caption)) {
          contenido = candidato;
          break;
        }
      }
      if (!contenido) throw new Error("el modelo no devolvió una pieza con slides y caption válida");
      const pieza: any = { id: tema.id, tema: tema.titulo, pilar: tema.pilar, tipo: tema.formato, santos: tema.santos, nivel: tema.nivel, ...contenido };

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

      // 4. Arte (descarga PD o IA) — si falla (p. ej. org no verificada para imágenes), fondo procedural
      try {
        await resolverArte(pieza);
      } catch (e) {
        console.warn(`  ⚠ arte falló (${String(e).slice(0, 140)}); se usa fondo procedural.`);
      }

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

  if (specPiezas.length === 0) throw new Error("No se generó ninguna pieza (revisá el cerebro editorial y los logs).");

  // 6. Render de todas las piezas
  console.log("\n▶ render…");
  execFileSync("npx", ["tsx", "scripts/render.ts", ...rutas], { cwd: ROOT, stdio: "inherit" });

  // 7. Ensamblar lote + memoria
  const file = await ensamblarLote({ semana, id: corrida, nombre: `Lote ${semana}`, piezas: specPiezas as any });
  console.log(`\n✓ Lote listo: ${file} · ${specPiezas.length} piezas · nada publicado (revisá en el panel).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
