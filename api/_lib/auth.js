import { createHmac, timingSafeEqual } from "node:crypto";

function firma(valor, secreto) {
  return createHmac("sha256", secreto).update(valor).digest("base64url");
}

export function coincideSecreto(recibido, esperado) {
  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Crea una cookie opaca y firmada. No contiene credenciales ni datos personales. */
export function crearSesion(secreto, ahora = Date.now(), minutos = 60 * 24 * 14) {
  const vence = String(ahora + minutos * 60_000);
  return `${vence}.${firma(vence, secreto)}`;
}

/** Verifica integridad y vencimiento de una sesión creada por crearSesion. */
export function leerSesion(token, secreto, ahora = Date.now()) {
  if (!token) return false;
  const [vence, recibida, extra] = token.split(".");
  if (!vence || !recibida || extra || !/^\d+$/.test(vence)) return false;
  const esperada = firma(vence, secreto);
  const a = Buffer.from(recibida, "utf8");
  const b = Buffer.from(esperada, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(vence) > ahora;
}
