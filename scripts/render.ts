/**
 * Render de piezas a PNG (resolución Instagram 4:5, 1080×1350).
 *
 * Uso:
 *   npm run render:sample            → renderiza las piezas de data/muestras/
 *   npm run render -- <pieza.json>   → renderiza una pieza puntual
 *
 * Sirve el repo por http (servidor estático interno) y navega las plantillas, así las rutas
 * absolutas (/templates, /assets) resuelven igual que en el panel. Usa el Chromium de
 * Playwright ya instalado en el entorno (no descarga navegadores).
 */
import { chromium, type Browser, type Page } from "playwright";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { startServer, ROOT } from "./server.ts";
import { verificarCanvas, type InformeSlideRender } from "./qa-render.ts";

const OUT = join(ROOT, "out");
const POST = { width: 1080, height: 1350 };
const REEL = { width: 1080, height: 1920 };

/** Resuelve el ejecutable de Chromium preinstalado en el entorno remoto (o deja que Playwright lo resuelva en local). */
function chromiumExecutable(): string | undefined {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p));
}

type Pieza = { id: string; tipo: "carrusel" | "cita"; slides?: unknown[]; [k: string]: unknown };

async function loadPieza(path: string): Promise<Pieza> {
  return JSON.parse(await readFile(path, "utf8")) as Pieza;
}

async function newPage(browser: Browser, baseUrl: string, template: string, canvas = POST): Promise<Page> {
  const page = await browser.newPage({ viewport: canvas, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/templates/${template}`, { waitUntil: "networkidle" });
  return page;
}

interface InformePiezaRender { pieza: string; ok: boolean; slides: InformeSlideRender[]; errores: string[]; }

async function renderCarrusel(browser: Browser, baseUrl: string, pieza: Pieza): Promise<{ files: string[]; informe: InformePiezaRender }> {
  const page = await newPage(browser, baseUrl, "carrusel.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  const files: string[] = [];
  const informes: InformeSlideRender[] = [];
  const n = (pieza.slides ?? []).length;
  for (let i = 0; i < n; i++) {
    await page.evaluate(([p, idx]) => (window as any).renderSlide(p, idx), [pieza, i] as const);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(60);
    const file = join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await page.locator("#canvas").screenshot({ path: file });
    files.push(file);
    informes.push(await verificarCanvas(page, i + 1, POST));
  }
  await page.close();
  const errores = informes.flatMap((informe) => informe.errores.map((error) => `slide ${informe.slide}: ${error}`));
  return { files, informe: { pieza: pieza.id, ok: errores.length === 0, slides: informes, errores } };
}

async function renderCita(browser: Browser, baseUrl: string, pieza: Pieza): Promise<{ files: string[]; informe: InformePiezaRender }> {
  const page = await newPage(browser, baseUrl, "cita.html");
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  await page.evaluate((p) => (window as any).renderCita(p), pieza);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(60);
  const file = join(outDir, "cita.png");
  await page.locator("#canvas").screenshot({ path: file });
  const informe = await verificarCanvas(page, 1, POST);
  await page.close();
  return { files: [file], informe: { pieza: pieza.id, ok: informe.ok, slides: [informe], errores: informe.errores.map((error) => `slide 1: ${error}`) } };
}

async function renderPieza(browser: Browser, baseUrl: string, pieza: Pieza): Promise<{ files: string[]; informe: InformePiezaRender }> {
  return pieza.tipo === "cita"
    ? renderCita(browser, baseUrl, pieza)
    : renderCarrusel(browser, baseUrl, pieza);
}

async function renderReel(browser: Browser, baseUrl: string, pieza: Pieza): Promise<{ file: string; informe: InformeSlideRender } | null> {
  if (!pieza.reel_portada) return null;
  const page = await newPage(browser, baseUrl, "reel.html", REEL);
  const outDir = join(OUT, pieza.id);
  await mkdir(outDir, { recursive: true });
  await page.evaluate((p) => (window as any).renderReel(p), pieza);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(60);
  const file = join(outDir, "reel-portada.png");
  await page.locator("#canvas").screenshot({ path: file });
  const informe = await verificarCanvas(page, 1, REEL);
  await page.close();
  return { file, informe };
}

async function main() {
  const args = process.argv.slice(2);
  const paths: string[] = [];

  if (args.includes("--sample")) {
    const dir = join(ROOT, "data", "muestras");
    for (const f of await readdir(dir)) if (f.endsWith(".json")) paths.push(join(dir, f));
  } else {
    for (const a of args) if (a.endsWith(".json")) paths.push(resolve(a));
  }

  if (paths.length === 0) {
    console.error("Nada para renderizar. Usá --sample o pasá un archivo .json de pieza.");
    process.exit(1);
  }

  const { server, url } = await startServer(0);
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    let fallo = false;
    for (const p of paths) {
      const pieza = await loadPieza(p);
      const { files, informe } = await renderPieza(browser, url, pieza);
      const reel = await renderReel(browser, url, pieza);
      if (reel) {
        files.push(reel.file);
        informe.slides.push({ ...reel.informe, slide: informe.slides.length + 1 });
        if (!reel.informe.ok) { informe.ok = false; informe.errores.push(...reel.informe.errores.map((error) => `portada Reel: ${error}`)); }
      }
      const informeRuta = join(OUT, pieza.id, "qa.json");
      await writeFile(informeRuta, JSON.stringify(informe, null, 2) + "\n");
      console.log(`${informe.ok ? "✓" : "✗"} ${pieza.id} (${pieza.tipo}) → ${files.length} imagen(es)`);
      for (const f of files) console.log(`    ${f.replace(ROOT + "/", "")}`);
      console.log(`    QA: ${informe.ok ? "ok" : informe.errores.join(" | ")}`);
      if (!informe.ok) fallo = true;
    }
    if (fallo) throw new Error("El QA técnico detectó errores de render.");
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nListo. Salida en ${OUT.replace(ROOT + "/", "")}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
