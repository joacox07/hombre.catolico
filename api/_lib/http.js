import { leerSesion } from "./auth.js";

export function responder(res, estado, cuerpo) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(cuerpo));
}

export async function cuerpoJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const texto = typeof req.body === "string" ? req.body : await new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  return JSON.parse(texto || "{}");
}

function cookie(req, nombre) {
  const encontrada = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${nombre}=`));
  return encontrada ? decodeURIComponent(encontrada.slice(nombre.length + 1)) : undefined;
}

export function requiereSesion(req, res) {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || !leerSesion(cookie(req, "hc_session"), secreto)) {
    responder(res, 401, { error: "Sesión requerida." });
    return false;
  }
  return true;
}

export function cookieSesion(res, valor) {
  res.setHeader("Set-Cookie", `hc_session=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 14}`);
}

export function borrarSesion(res) {
  res.setHeader("Set-Cookie", "hc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}
