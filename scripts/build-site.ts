/**
 * Arma `site/` para Vercel: panel estático + API serverless. El panel consulta el lote vivo
 * desde GitHub y usa las imágenes del repo remoto, por eso no necesita redeploy por cada lote.
 *
 * Uso:  tsx scripts/build-site.ts   → genera ./site
 */
import { rm, mkdir, cp, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");
const OWNER = process.env.GITHUB_OWNER || "joacox07";
const REPO = process.env.GITHUB_REPO || "hombre.catolico";
const BRANCH = process.env.GITHUB_BRANCH || "claude/hombre-catolico-instagram-ogg8ao";

async function main() {
  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  // Recursos que el panel referencia (mismas rutas relativas que en local, pero sin la barra inicial).
  await mkdir(join(SITE, "templates"), { recursive: true });
  for (const f of ["tokens.css", "pieza.css", "render.js"]) {
    await copyFile(join(ROOT, "templates", f), join(SITE, "templates", f));
  }
  await cp(join(ROOT, "assets"), join(SITE, "assets"), { recursive: true });
  await cp(join(ROOT, "data"), join(SITE, "data"), { recursive: true });

  // index.html: rutas absolutas → relativas + inyección de APIs y arte remoto.
  let html = await readFile(join(ROOT, "panel", "index.html"), "utf8");
  html = html
    .replace(/\/templates\//g, "templates/")
    .replace(/\/panel\/styles\.css/g, "styles.css")
    .replace(/\/panel\/app\.js/g, "app.js")
    .replace(
      '<script src="templates/render.js"></script>',
      `<script>window.SITE_BASE="";window.HC_API_BASE="/api";window.HC_ARTE_BASE=${JSON.stringify(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/assets/arte/`)};</script>\n<script src="templates/render.js"></script>`,
    );
  await writeFile(join(SITE, "index.html"), html);

  // app.js y styles.css tal cual (app.js ya usa window.SITE_BASE).
  await copyFile(join(ROOT, "panel", "app.js"), join(SITE, "app.js"));
  await copyFile(join(ROOT, "panel", "styles.css"), join(SITE, "styles.css"));

  console.log("✓ site/ listo para Vercel");
}

main().catch((e) => { console.error(e); process.exit(1); });
