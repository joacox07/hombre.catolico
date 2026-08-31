/** Identidad estable de una corrida. Evita que dos lotes de la misma semana se pisen. */
export function idLote(semana: string, corrida?: string): string {
  const sufijo = String(corrida || "").trim();
  return sufijo ? `${semana}-${sufijo}` : semana;
}

export function archivoLote(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`ID de lote inválido: ${id}`);
  return `data/lotes/lote-${id}.json`;
}
