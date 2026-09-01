export function configGitHub() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "claude/hombre-catolico-instagram-ogg8ao";
  if (!token || !owner || !repo) throw new Error("Falta configurar la conexión segura con GitHub.");
  return { token, owner, repo, branch };
}

async function github(path, init = {}) {
  const cfg = configGitHub();
  const response = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}.`);
  return response;
}

export async function contenidoJson(path) {
  const cfg = configGitHub();
  const response = await github(`/contents/${path.replace(/^\//, "")}?ref=${encodeURIComponent(cfg.branch)}`);
  const contenido = await response.json();
  if (contenido.encoding !== "base64" || !contenido.content) throw new Error("GitHub devolvió un archivo inválido.");
  return JSON.parse(Buffer.from(contenido.content.replace(/\n/g, ""), "base64").toString("utf8"));
}

export async function dispararGeneracion(solicitud) {
  const cfg = configGitHub();
  await github("/actions/workflows/semanal.yml/dispatches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: cfg.branch, inputs: { cantidad: "3", solicitud } }),
  });
}

export function buscarCorrida(solicitud, corridas) {
  const corrida = corridas.find((item) => item.display_title === `Lote móvil ${solicitud}`);
  return corrida ? {
    estado: corrida.status || "queued",
    resultado: corrida.conclusion || null,
    url: corrida.html_url || "",
  } : null;
}

export async function estadoGeneracion(solicitud) {
  const response = await github("/actions/workflows/semanal.yml/runs?event=workflow_dispatch&per_page=30");
  const datos = await response.json();
  return buscarCorrida(solicitud, datos.workflow_runs || []);
}

function idDeResumen(resumen, lote) {
  return lote?.id || resumen.id || resumen.semana;
}

/** Un aviso de documentación no es una pieza editorial que deba abrir el panel. */
export function esPiezaEditorial(pieza) {
  return Array.isArray(pieza?.fuentes) && pieza.fuentes.length > 0;
}

async function cargarLote(resumen) {
  const lote = await contenidoJson(resumen.file);
  const piezas = await Promise.all(lote.piezas.map(async (meta) => ({
    meta,
    pieza: await contenidoJson(meta.ref),
  })));
  return { lote: { ...lote, id: idDeResumen(resumen, lote) }, piezas };
}

export async function listarLotes() {
  const indice = await contenidoJson("data/lotes/index.json");
  return Promise.all((indice.lotes || []).map(async (resumen) => {
    const lote = await contenidoJson(resumen.file);
    return {
      id: idDeResumen(resumen, lote),
      nombre: resumen.nombre,
      semana: resumen.semana,
      generado: resumen.generado,
      piezas: lote.piezas?.length || 0,
    };
  }));
}

export async function lotePorId(loteId) {
  const indice = await contenidoJson("data/lotes/index.json");
  const resumen = (indice.lotes || []).find((item) => (item.id || item.semana) === loteId);
  if (!resumen) throw new Error("No existe ese lote.");
  return cargarLote(resumen);
}

export async function ultimoLote() {
  const indice = await contenidoJson("data/lotes/index.json");
  const resumenes = indice.lotes || [];
  if (!resumenes.length) throw new Error("Todavía no hay lotes generados.");
  for (const resumen of resumenes) {
    const lote = await cargarLote(resumen);
    if (lote.piezas.some(({ pieza }) => esPiezaEditorial(pieza))) return lote;
  }
  return cargarLote(resumenes[0]);
}

export async function descarga(loteId, piezaId) {
  const response = await github(`/releases/tags/${encodeURIComponent(`lote-${loteId}`)}`);
  const release = await response.json();
  return release.assets?.find((asset) => asset.name === `${piezaId}.zip`)?.browser_download_url || null;
}
