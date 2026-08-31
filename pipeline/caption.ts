/** Reglas mínimas para que una descripción sea utilizable en Instagram. */
export function captionLista(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  const texto = valor.trim();
  if (texto.length < 80) return false;
  const hashtags = texto.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu) || [];
  return hashtags.length >= 3 && hashtags.length <= 5;
}
