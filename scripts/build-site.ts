/**
 * Arma `site/` para publicar el panel en GitHub Pages (funciona bajo /usuario.github.io/repo/).
 * Copia panel + templates + assets + data a un solo árbol con index.html en la raíz y rutas
 * relativas (SITE_BASE="" y HC_ARTE_BASE="assets/arte/"). El modo local no se toca.
 *
 * Uso:  tsx scripts/build-site.ts   → genera ./site
 */
import { rm, mkdir, cp, readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site");

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

  // index.html: rutas absolutas → relativas + inyección de la base del sitio.
  let html = await readFile(join(ROOT, "panel", "index.html"), "utf8");
  html = html
    .replace(/\/templates\//g, "templates/")
    .replace(/\/panel\/styles\.css/g, "styles.css")
    .replace(/\/panel\/app\.js/g, "app.js")
    .replace(
      '<script src="templates/render.js"></script>',
      '<script>window.SITE_BASE="";window.HC_ARTE_BASE="assets/arte/";</script>\n<script src="templates/render.js"></script>',
    );
  await writeFile(join(SITE, "index.html"), html);

  // app.js y styles.css tal cual (app.js ya usa window.SITE_BASE).
  await copyFile(join(ROOT, "panel", "app.js"), join(SITE, "app.js"));
  await copyFile(join(ROOT, "panel", "styles.css"), join(SITE, "styles.css"));

  // .nojekyll para que Pages sirva archivos que empiezan con _ y no procese Jekyll.
  await writeFile(join(SITE, ".nojekyll"), "");

  console.log("✓ site/ listo para GitHub Pages");
}

main().catch((e) => { console.error(e); process.exit(1); });
