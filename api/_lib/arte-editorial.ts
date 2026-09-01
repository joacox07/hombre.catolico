export const DESTINOS_ARTE = new Set(["post", "reel"]);
const DATA_IMAGE = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export function referenciasValidas(valor: unknown): string[] {
  if (valor == null) return [];
  if (!Array.isArray(valor) || valor.length > 3) throw new Error("Podés usar hasta tres referencias.");
  return valor.map((referencia) => {
    if (typeof referencia !== "string" || !DATA_IMAGE.test(referencia) || referencia.length > 2_100_000) {
      throw new Error("Cada referencia debe ser PNG, JPG o WebP y pesar menos de 1,5 MB.");
    }
    return referencia;
  });
}

export function validarSolicitudArte(cuerpo: any) {
  const lote_id = typeof cuerpo?.lote_id === "string" ? cuerpo.lote_id : "";
  const pieza_id = typeof cuerpo?.pieza_id === "string" ? cuerpo.pieza_id : "";
  const destino = typeof cuerpo?.destino === "string" ? cuerpo.destino : "";
  const consulta = typeof cuerpo?.consulta === "string" ? cuerpo.consulta.trim().slice(0, 320) : "";
  if (!/^\d{4}-W\d{2}(?:-[\w-]+)?$/.test(lote_id)) throw new Error("Lote inválido.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(pieza_id)) throw new Error("Pieza inválida.");
  if (!DESTINOS_ARTE.has(destino)) throw new Error("Destino de imagen inválido.");
  if (!consulta) throw new Error("Escribí qué imagen estás buscando.");
  const referencias = referenciasValidas(cuerpo?.referencias);
  if (referencias.length && cuerpo?.derechos_referencias !== true) {
    throw new Error("Confirmá que podés usar las referencias para orientar una creación original.");
  }
  return { lote_id, pieza_id, destino: destino as "post" | "reel", consulta, referencias };
}

export function promptEditorial(pieza: any, consulta: string, destino: "post" | "reel"): string {
  const formato = destino === "reel" ? "vertical 9:16, con zona central despejada para portada de Reel" : "vertical 4:5, con espacio negativo para texto";
  return [
    "Creá una imagen editorial original para @hombre.catolico.",
    `Tema: ${pieza?.tema || pieza?.titulo || consulta}. Pedido del editor: ${consulta}.`,
    `Formato: ${formato}.`,
    "Estética: imagen evocadora, sobria y fílmica; luz cálida o chiaroscuro; crema, dorado, tabaco y negro; textura de grano; sin texto, letras, logos ni marcas.",
    "No copies las referencias ni reproduzcas una obra reconocible. No representes santos identificables ni presentes la imagen como arte histórico.",
  ].join(" ");
}

export function esSantoConcreto(pieza: any): boolean {
  return Array.isArray(pieza?.santos) && pieza.santos.some((santo: unknown) => typeof santo === "string" && santo.trim());
}

export function artePendienteDeRender(pieza: any) {
  const control = pieza?.control_calidad;
  if (!control) return pieza;
  const alertas = Array.isArray(control.alertas) ? control.alertas.filter((alerta: any) =>
    alerta?.codigo !== "arte_sin_procedencia" && alerta?.codigo !== "render_tecnico_fallido" && alerta?.codigo !== "render_pendiente",
  ) : [];
  alertas.push({ codigo: "render_pendiente", nivel: "bloqueo", detalle: "El arte cambió: falta validar el nuevo render." });
  pieza.control_calidad = {
    ...control,
    candados: { ...control.candados, arte_procedencia: true, render_tecnico: "pendiente" },
    alertas,
    revision_humana_requerida: true,
    bloquea_aprobacion: true,
  };
  return pieza;
}

export function portadaDe(pieza: any) {
  return (pieza?.slides || []).find((slide: any) => slide?.tipo === "portada") || {};
}
