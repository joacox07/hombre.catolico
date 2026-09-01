/**
 * Gateway privado para el cerebro editorial.
 *
 * Expone sólo el mínimo compatible con Chat Completions que consume el pipeline
 * y ejecuta `codex exec` con la sesión oficial iniciada en la máquina anfitriona.
 * No usa cookies de chatgpt.com, ni automatiza un navegador, ni conoce la key de
 * OpenAI que genera imágenes.
 */
import { createServer } from "node:http";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";

const puerto = Number(process.env.PORT || "8787");
const token = process.env.CODEX_GATEWAY_TOKEN;
const workspace = process.env.CODEX_GATEWAY_WORKSPACE || "/var/lib/hombre-cerebro/workspace";
const codexHome = process.env.CODEX_HOME || "/var/lib/hombre-cerebro/codex-home";
const maxBytes = 1_000_000;
const timeoutMs = 170_000;

if (!token || token.length < 32) {
  throw new Error("CODEX_GATEWAY_TOKEN debe tener al menos 32 caracteres aleatorios.");
}

let ocupado = false;
const trabajos = new Map();
const retencionTrabajoMs = 10 * 60_000;

function autorizado(cabecera) {
  const recibido = cabecera?.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const a = Buffer.from(recibido);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(cuerpo));
}

async function leerJson(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > maxBytes) throw new Error("Cuerpo demasiado grande.");
    partes.push(parte);
  }
  return JSON.parse(Buffer.concat(partes).toString("utf8"));
}

function textoDeMensaje(mensaje) {
  if (typeof mensaje?.content === "string") return mensaje.content;
  throw new Error("Cada mensaje debe tener contenido de texto.");
}

function convertirPrompt(body) {
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    throw new Error("messages es obligatorio.");
  }
  const sistema = body.messages.filter((m) => m?.role === "system").map(textoDeMensaje).join("\n\n");
  const usuario = body.messages.filter((m) => m?.role === "user").map(textoDeMensaje).join("\n\n");
  if (!usuario) throw new Error("Falta el mensaje del usuario.");
  const json = body?.response_format?.type === "json_object";
  return [
    "Sos el cerebro editorial de @hombre.catolico.",
    "Respondé únicamente a la solicitud editorial. No ejecutes comandos, no navegues ni modifiques archivos.",
    json ? "La respuesta final debe ser ÚNICAMENTE un objeto JSON válido, sin Markdown." : "Devolvé sólo la respuesta final solicitada.",
    "\nINSTRUCCIONES EDITORIALES:\n" + sistema,
    "\nSOLICITUD Y FUENTES:\n" + usuario,
  ].join("\n");
}

async function ejecutarCodex(prompt) {
  await mkdir(workspace, { recursive: true });
  const salida = join(tmpdir(), `hombre-cerebro-${randomUUID()}.txt`);
  const args = [
    "exec", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config",
    "--output-last-message", salida, "-",
  ];
  await new Promise((resolve, reject) => {
    const hijo = spawn("codex", args, {
      cwd: workspace,
      env: { ...process.env, CODEX_HOME: codexHome },
      stdio: ["pipe", "ignore", "pipe"],
    });
    let error = "";
    const reloj = setTimeout(() => hijo.kill("SIGTERM"), timeoutMs);
    hijo.stderr.on("data", (chunk) => { error = (error + chunk.toString()).slice(-2000); });
    hijo.once("error", (err) => { clearTimeout(reloj); reject(err); });
    hijo.once("close", (codigo) => {
      clearTimeout(reloj);
      if (codigo === 0) resolve(undefined);
      else reject(new Error(`Codex finalizó con código ${codigo}: ${error.slice(-500)}`));
    });
    hijo.stdin.end(prompt);
  });
  try {
    return (await readFile(salida, "utf8")).trim();
  } finally {
    await rm(salida, { force: true });
  }
}

function respuestaFinal(contenido) {
  return {
    id: `chatcmpl_${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "hombre-catolico-editorial",
    choices: [{ index: 0, message: { role: "assistant", content: contenido }, finish_reason: "stop" }],
  };
}

function iniciarTrabajo(prompt) {
  const id = `job_${randomUUID()}`;
  const trabajo = { estado: "queued", creado: Date.now(), respuesta: null, error: null };
  trabajos.set(id, trabajo);
  ocupado = true;

  void ejecutarCodex(prompt).then((contenido) => {
    if (!contenido) throw new Error("Codex no devolvió contenido final.");
    trabajo.respuesta = respuestaFinal(contenido);
    trabajo.estado = "completed";
  }).catch((error) => {
    console.error("Fallo del cerebro editorial:", String(error).slice(0, 800));
    trabajo.error = "El cerebro editorial no está disponible. Revisá su sesión de Codex o reintentá más tarde.";
    trabajo.estado = "failed";
  }).finally(() => {
    ocupado = false;
    const limpieza = setTimeout(() => trabajos.delete(id), retencionTrabajoMs);
    limpieza.unref();
  });
  return id;
}

const servidor = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    return responder(res, 200, { ok: true, ocupado });
  }
  if (!autorizado(req.headers.authorization)) {
    return responder(res, 401, { error: { message: "No autorizado." } });
  }

  const rutaTrabajo = req.url?.match(/^\/v1\/jobs\/([^/?]+)$/);
  if (req.method === "GET" && rutaTrabajo) {
    const trabajo = trabajos.get(decodeURIComponent(rutaTrabajo[1]));
    if (!trabajo) return responder(res, 404, { error: { message: "Trabajo no encontrado o vencido." } });
    if (trabajo.estado === "completed") return responder(res, 200, trabajo.respuesta);
    if (trabajo.estado === "failed") return responder(res, 503, { error: { message: trabajo.error } });
    return responder(res, 202, { id: rutaTrabajo[1], status: trabajo.estado });
  }

  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    return responder(res, 404, { error: { message: "Ruta no encontrada." } });
  }
  if (ocupado) {
    return responder(res, 429, { error: { message: "El cerebro está ocupado; reintentá al finalizar la corrida actual." } });
  }

  try {
    const body = await leerJson(req);
    const prompt = convertirPrompt(body);
    const id = iniciarTrabajo(prompt);
    return responder(res, 202, { id, object: "hombre.cerebro.job", status: "queued" });
  } catch (error) {
    console.error("Fallo del cerebro editorial:", String(error).slice(0, 800));
    return responder(res, 503, { error: { message: "El cerebro editorial no está disponible. Revisá su sesión de Codex o reintentá más tarde." } });
  }
});

servidor.listen(puerto, "127.0.0.1", () => {
  console.log(`Cerebro editorial escuchando sólo en 127.0.0.1:${puerto}`);
});
