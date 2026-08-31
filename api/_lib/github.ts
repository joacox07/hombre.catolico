type Config = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
};

type Run = {
  display_title?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
};

export function configGitHub(): Config {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "claude/hombre-catolico-instagram-ogg8ao";
  if (!token || !owner || !repo) throw new Error("Falta configurar la conexión segura con GitHub.");
  return { token, owner, repo, branch };
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
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

export async function contenidoJson<T>(path: string): Promise<T> {
  const cfg = configGitHub();
  const response = await github(`/contents/${path.replace(/^\//, "")}?ref=${encodeURIComponent(cfg.branch)}`);
  const contenido = await response.json() as { content?: string; encoding?: string };
  if (contenido.encoding !== "base64" || !contenido.content) throw new Error("GitHub devolvió un archivo inválido.");
  return JSON.parse(Buffer.from(contenido.content.replace(/\n/g, ""), "base64").toString("utf8")) as T;
}

export async function dispararGeneracion(solicitud: string): Promise<void> {
  const cfg = configGitHub();
  await github("/actions/workflows/semanal.yml/dispatches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: cfg.branch, inputs: { cantidad: "3", solicitud } }),
  });
}

export function buscarCorrida(solicitud: string, corridas: Run[]): { estado: string; resultado: string | null; url: string } | null {
  const corrida = corridas.find((item) => item.display_title?.includes(solicitud));
  return corrida ? {
    estado: corrida.status || "queued",
    resultado: corrida.conclusion || null,
    url: corrida.html_url || "",
  } : null;
}

export async function estadoGeneracion(solicitud: string) {
  const response = await github("/actions/workflows/semanal.yml/runs?event=workflow_dispatch&per_page=30");
  const datos = await response.json() as { workflow_runs?: Run[] };
  return buscarCorrida(solicitud, datos.workflow_runs || []);
}

export async function ultimoLote() {
  type Indice = { lotes: Array<{ id?: string; file: string; nombre: string; semana: string; generado: string }> };
  type Lote = { id?: string; nombre: string; semana: string; generado: string; piezas: Array<Record<string, unknown> & { ref: string }> };
  const indice = await contenidoJson<Indice>("data/lotes/index.json");
  const resumen = indice.lotes[0];
  if (!resumen) throw new Error("Todavía no hay lotes generados.");
  const lote = await contenidoJson<Lote>(resumen.file);
  const piezas = await Promise.all(lote.piezas.map(async (meta) => ({
    meta,
    pieza: await contenidoJson<Record<string, unknown>>(meta.ref),
  })));
  return { lote: { ...lote, id: lote.id || resumen.id || lote.semana }, piezas };
}

export async function descarga(loteId: string, piezaId: string): Promise<string | null> {
  const response = await github(`/releases/tags/${encodeURIComponent(`lote-${loteId}`)}`);
  const release = await response.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
  return release.assets?.find((asset) => asset.name === `${piezaId}.zip`)?.browser_download_url || null;
}
