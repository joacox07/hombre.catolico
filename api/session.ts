import { coincideSecreto, crearSesion } from "./_lib/auth.js";
import { borrarSesion, cuerpoJson, cookieSesion, responder } from "./_lib/http.js";

export default async function handler(req: any, res: any) {
  if (req.method === "DELETE") {
    borrarSesion(res);
    responder(res, 200, { ok: true });
    return;
  }
  if (req.method !== "POST") {
    responder(res, 405, { error: "Método no permitido." });
    return;
  }
  try {
    const { password } = await cuerpoJson(req) as { password?: string };
    const esperada = process.env.PANEL_PASSWORD;
    const secreto = process.env.SESSION_SECRET;
    if (!esperada || !secreto) throw new Error("Panel sin configurar.");
    if (!password || !coincideSecreto(password, esperada)) {
      responder(res, 401, { error: "Contraseña incorrecta." });
      return;
    }
    cookieSesion(res, crearSesion(secreto));
    responder(res, 200, { ok: true });
  } catch {
    responder(res, 500, { error: "No se pudo iniciar sesión." });
  }
}
