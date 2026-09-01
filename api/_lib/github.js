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
  if (!response.ok) {
    const error = new Error(`GitHub respondió ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response;
}

export async function contenidoJson(path) {
  return (await contenidoJsonConSha(path)).contenido;
}

export async function contenidoJsonConSha(path) {
  const cfg = configGitHub();
  const response = await github(`/contents/${path.replace(/^\//, "")}?ref=${encodeURIComponent(cfg.branch)}`);
  const archivo = await response.json();
  if (archivo.encoding !== "base64" || !archivo.content || !archivo.sha) throw new Error("GitHub devolvió un archivo inválido.");
  return {
    contenido: JSON.parse(Buffer.from(archivo.content.replace(/\n/g, ""), "base64").toString("utf8")),
    version: archivo.sha,
  };
}

export async function guardarJson(path, contenido, version, mensaje) {
  const cfg = configGitHub();
  const cuerpo = {
    message: mensaje,
    content: Buffer.from(JSON.stringify(contenido, null, 2) + "\n").toString("base64"),
    branch: cfg.branch,
    ...(version ? { sha: version } : {}),
  };
  const response = await github(`/contents/${path.replace(/^\//, "")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const resultado = await response.json();
  const sha = resultado?.content?.sha;
  if (typeof sha !== "string" || !sha) throw new Error("GitHub no confirmó la versión guardada.");
  return sha;
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
  const id = idDeResumen(resumen, lote);
  return { lote: { ...lote, id }, piezas, revision: await revisionPorLote(id) };
}

function archivoRevision(loteId) {
  return `data/revisiones/${loteId}.json`;
}

export async function revisionPorLote(loteId) {
  try {
    return await contenidoJsonConSha(archivoRevision(loteId));
  } catch (error) {
    if (error?.status === 404) return { contenido: { schema: 1, lote_id: loteId, actualizado_en: null, revisiones: {}, eventos: [] }, version: null };
    throw error;
  }
}

export async function guardarRevision(loteId, contenido, version) {
  const nuevaVersion = await guardarJson(
    archivoRevision(loteId), contenido, version,
    `Mesa editorial: registrar revisión del lote ${loteId}`,
  );
  return { contenido, version: nuevaVersion };
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
