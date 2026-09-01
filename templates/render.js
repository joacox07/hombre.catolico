/* Render de piezas v2 — fuente única de verdad (file:// para PNG y http para panel).
   Expone globalThis.HC = { esc, slideHTML, citaHTML }.
   Devuelve el HTML interno de un elemento .hc-canvas: un wrapper .arq-* con la capa de
   tratamiento (arte + gradación + viñeta + grano) y el contenido del arquetipo. */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  // Destacado en dorado: **texto** -> <span class="oro">texto</span> (se escapa antes).
  function emph(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="oro">$1</span>');
  }
  // Párrafos: separa por línea en blanco.
  function paras(s) {
    return String(s || "").split(/\n\s*\n/).map(function (p) {
      return "<p>" + emph(p.replace(/\n/g, " ")) + "</p>";
    }).join("");
  }
  // Base de las imágenes de arte. Por defecto ruta absoluta (local, servidor en la raíz);
  // en GitHub Pages el panel setea window.HC_ARTE_BASE = "assets/arte/" (relativa a la URL).
  function arteBase() {
    return (typeof window !== "undefined" && window.HC_ARTE_BASE) || "/assets/arte/";
  }
  function posicionSegura(posicion) {
    var match = String(posicion || "").trim().match(/^(\d{1,3})%\s+(\d{1,3})%$/);
    if (!match || Number(match[1]) > 100 || Number(match[2]) > 100) return "";
    return "background-position:" + match[1] + "% " + match[2] + "%";
  }
  // Capa de tratamiento común. arte = {archivo?, posicion?} de la pieza.
  function layers(arte) {
    var posicion = posicionSegura(arte && arte.posicion);
    var bg = arte && arte.archivo
      ? '<div class="capa arte" style="background-image:url(\'' + arteBase() + esc(arte.archivo) + '\');' + posicion + '"></div>'
      : '<div class="capa arte proc"></div>';
    return bg + '<div class="capa grade"></div><div class="capa vineta"></div><div class="capa grano"></div>';
  }
  function cabecera() {
    return '<div class="cabecera"><span class="mono">✠</span>' +
      '<span class="nombre">Hombre Católico</span>' +
      '<span class="handle">@hombre.catolico</span></div>';
  }

  function slideHTML(pieza, index) {
    var slide = pieza.slides[index];
    var arte = slide.arte || pieza.arte;

    // Portada -> Arquetipo A (impacto)
    if (slide.tipo === "portada") {
      return '<div class="arq arq-a">' + layers(arte) +
        '<div class="contenido">' +
          '<div class="cruz">✠</div><div class="push"></div>' +
          (slide.kicker ? '<div class="kicker">' + esc(slide.kicker) + "</div>" : "") +
          '<h1 class="titulo-impacto' + (slide.autor ? " q" : "") + '">' + esc(slide.titulo) + "</h1>" +
          (slide.autor ? '<div class="autor-impacto">' + esc(slide.autor) + "</div>" : "") +
          (slide.subtitulo ? '<p class="subtitulo">' + esc(slide.subtitulo) + "</p>" : "") +
          '<div class="pie fila"><span class="marca grow">@hombre.catolico</span>' +
            (slide.credito_obra ? '<span class="credito">' + esc(slide.credito_obra) + "</span>" : "") +
          "</div>" +
        "</div></div>";
    }

    // Cierre -> Arquetipo B (variante fuentes + CTA)
    if (slide.tipo === "cierre") {
      var fuentes = (slide.fuentes || []).map(function (f) { return '<div class="fuente">' + esc(f) + "</div>"; }).join("");
      return '<div class="arq arq-b">' + layers(arte) +
        '<div class="contenido">' + cabecera() +
          (slide.titulo ? '<h2 class="titulo">' + emph(slide.titulo) + "</h2>" : "") +
          (slide.cuerpo ? '<div class="cuerpo">' + paras(slide.cuerpo) + "</div>" : "") +
          '<div class="push"></div>' +
          '<div class="kicker">Fuentes</div>' +
          '<div class="lista-fuentes" style="margin-top:12px">' + fuentes + "</div>" +
          (slide.cta ? '<p class="cuerpo" style="font-style:italic;font-size:40px;margin-top:26px">' + esc(slide.cta) + "</p>" : "") +
          '<div class="pie"><span class="marca">@hombre.catolico</span></div>' +
        "</div></div>";
    }

    // Contenido -> Arquetipo B (texto largo)
    return '<div class="arq arq-b">' + layers(arte) +
      '<div class="contenido">' + cabecera() +
        (slide.titulo ? '<h2 class="titulo">' + emph(slide.titulo) + "</h2>" : "") +
        '<div class="cuerpo">' + paras(slide.cuerpo) + "</div>" +
        (slide.fuente ? '<div class="fuente">' + esc(slide.fuente) + "</div>" : "") +
        '<div class="pie fila"><span class="credito grow">' + esc((index + 1) + " · " + pieza.slides.length) + "</span>" +
          '<span class="marca" style="font-size:24px">@hombre.catolico</span></div>' +
      "</div></div>";
  }

  // Cita -> Arquetipo C (devocional)
  function citaHTML(pieza) {
    return '<div class="arq arq-c">' + layers(pieza.arte) +
      '<div class="contenido">' +
        '<div class="comilla">“</div>' +
        '<blockquote class="cita-texto">' + emph(pieza.cita) + "</blockquote>" +
        '<div class="autor">' + esc(pieza.autor) + "</div>" +
        (pieza.fuente ? '<div class="fuente">' + esc(pieza.fuente) + "</div>" : "") +
      "</div>" +
      '<div class="marca-c">@hombre.catolico</div></div>';
  }

  global.HC = { esc: esc, emph: emph, slideHTML: slideHTML, citaHTML: citaHTML };
})(typeof window !== "undefined" ? window : globalThis);
