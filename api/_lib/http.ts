import type { IncomingMessage, ServerResponse } from "node:http";
import { leerSesion } from "./auth.ts";

export type ApiRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
};

export function responder(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(cuerpo));
}

export async function cuerpoJson<T>(req: ApiRequest): Promise<T> {
  if (req.body && typeof req.body === "object") return req.body as T;
  const texto = typeof req.body === "string" ? req.body : await new Promise<string>((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  return JSON.parse(texto || "{}") as T;
}

function cookie(req: ApiRequest, nombre: string): string | undefined {
  const encontrada = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${nombre}=`));
  return encontrada ? decodeURIComponent(encontrada.slice(nombre.length + 1)) : undefined;
}

export function requiereSesion(req: ApiRequest, res: ServerResponse): boolean {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || !leerSesion(cookie(req, "hc_session"), secreto)) {
    responder(res, 401, { error: "Sesión requerida." });
    return false;
  }
  return true;
}

export function cookieSesion(res: ServerResponse, valor: string): void {
  res.setHeader("Set-Cookie", `hc_session=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 14}`);
}

export function borrarSesion(res: ServerResponse): void {
  res.setHeader("Set-Cookie", "hc_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}
