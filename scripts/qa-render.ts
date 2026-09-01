/** QA técnico del canvas antes de que una pieza entre al lote. */
import type { Page } from "playwright";

export interface InformeSlideRender {
  slide: number;
  ok: boolean;
  errores: string[];
}

export async function verificarCanvas(page: Page, slide: number, esperado = { width: 1080, height: 1350 }): Promise<InformeSlideRender> {
  const resultado = await page.evaluate(async (dimensiones) => {
    const canvas = document.querySelector("#canvas") as HTMLElement | null;
    const errores: string[] = [];
    if (!canvas) return { errores: ["No existe #canvas."] };
    const canvasRect = canvas.getBoundingClientRect();
    if (Math.round(canvasRect.width) !== dimensiones.width || Math.round(canvasRect.height) !== dimensiones.height) {
      errores.push(`Canvas inválido: ${Math.round(canvasRect.width)}×${Math.round(canvasRect.height)}.`);
    }
    if (canvas.scrollWidth > canvas.clientWidth + 1 || canvas.scrollHeight > canvas.clientHeight + 1) {
      errores.push("El canvas tiene desborde interno.");
    }
    const fuera = Array.from(canvas.querySelectorAll<HTMLElement>("*")).some((elemento) => {
      const estilo = getComputedStyle(elemento);
      if (estilo.display === "none" || estilo.visibility === "hidden") return false;
      const rect = elemento.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return false;
      return rect.left < canvasRect.left - 1 || rect.top < canvasRect.top - 1 ||
        rect.right > canvasRect.right + 1 || rect.bottom > canvasRect.bottom + 1;
    });
    if (fuera) errores.push("Hay un elemento fuera del canvas.");
    if (document.fonts.status !== "loaded") errores.push("Las fuentes no terminaron de cargar.");
    const artes = Array.from(canvas.querySelectorAll<HTMLElement>(".arte"));
    for (const elemento of artes) {
      const fondo = getComputedStyle(elemento).backgroundImage;
      if (fondo === "none") { errores.push("Hay una capa de arte sin fondo."); continue; }
      const coincidencia = fondo.match(/^url\(["']?(.*?)["']?\)$/);
      if (!coincidencia || !coincidencia[1] || coincidencia[1].startsWith("data:")) continue;
      try {
        const respuesta = await fetch(coincidencia[1], { cache: "no-store" });
        if (!respuesta.ok) errores.push(`No se pudo cargar el arte (${respuesta.status}).`);
      } catch {
        errores.push("No se pudo cargar el arte.");
      }
    }
    return { errores };
  }, esperado);
  return { slide, ok: resultado.errores.length === 0, errores: resultado.errores };
}
