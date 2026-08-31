/* Render de piezas — fuente única de verdad.
   Script clásico (no módulo) para funcionar tanto por file:// (Playwright → PNG) como
   por http (panel). Expone globalThis.HC = { esc, slideHTML, citaHTML }.
   Las funciones devuelven el HTML *interno* de un elemento con clase .hc-canvas. */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  // Devuelve el HTML interno para UNA diapositiva de un carrusel.
  function slideHTML(pieza, index) {
    var slide = pieza.slides[index];
    var arteUrl = pieza.arte && pieza.arte.archivo ? "/assets/arte/" + pieza.arte.archivo : null;
    var bg = arteUrl ? "background-image:url('" + esc(arteUrl) + "')" : "";

    if (slide.tipo === "portada") {
      return "" +
        '<div class="arte" style="' + bg + '"></div>' +
        '<div class="velo"></div>' +
        '<div class="marco"></div>' +
        '<div class="contenido portada">' +
          '<div class="fila"><span class="cruz">✠</span></div>' +
          '<div class="push"></div>' +
          (slide.kicker ? '<div class="kicker">' + esc(slide.kicker) + "</div>" : "") +
          '<h1 class="titulo gap-s">' + esc(slide.titulo) + "</h1>" +
          (slide.subtitulo ? '<p class="subtitulo gap-m">' + esc(slide.subtitulo) + "</p>" : "") +
          '<div class="gap-l fila">' +
            '<span class="marca grow">@hombre.catolico</span>' +
            (slide.credito_obra ? '<span class="credito">' + esc(slide.credito_obra) + "</span>" : "") +
          "</div>" +
        "</div>";
    }

    if (slide.tipo === "cierre") {
      var fuentes = (slide.fuentes || []).map(function (f) {
        return '<div class="fuente">' + esc(f) + "</div>";
      }).join("");
      return "" +
        '<div class="arte" style="' + bg + ';filter:saturate(.7) brightness(.5)"></div>' +
        '<div class="velo" style="background:linear-gradient(180deg,rgba(32,29,25,.82),rgba(32,29,25,.92))"></div>' +
        '<div class="marco"></div>' +
        '<div class="contenido contenido-slide">' +
          '<div class="fila"><span class="cruz">✠</span></div>' +
          (slide.titulo ? '<h2 class="titulo gap-m" style="font-size:56px">' + esc(slide.titulo) + "</h2>" : "") +
          (slide.cuerpo ? '<p class="cuerpo gap-m">' + esc(slide.cuerpo) + "</p>" : "") +
          '<div class="push"></div>' +
          '<div class="kicker">Fuentes</div>' +
          '<div class="lista-fuentes gap-s">' + fuentes + "</div>" +
          (slide.cta ? '<p class="subtitulo gap-m" style="font-size:34px">' + esc(slide.cta) + "</p>" : "") +
          '<div class="gap-m"><span class="marca">@hombre.catolico</span></div>' +
        "</div>";
    }

    // contenido
    return "" +
      '<div class="arte" style="background-image:radial-gradient(120% 80% at 50% 20%, #4b4034 0%, #2b251e 60%, #201d19 100%)"></div>' +
      '<div class="marco"></div>' +
      '<div class="contenido contenido-slide">' +
        (slide.kicker ? '<div class="kicker">' + esc(slide.kicker) + "</div>" : "") +
        (slide.titulo ? '<h2 class="titulo gap-s">' + esc(slide.titulo) + "</h2>" : "") +
        '<p class="cuerpo gap-m grow">' + esc(slide.cuerpo) + "</p>" +
        (slide.fuente ? '<div class="fuente gap-m">' + esc(slide.fuente) + "</div>" : "") +
        '<div class="gap-s fila">' +
          '<span class="credito grow">' + esc((index + 1) + " · " + pieza.slides.length) + "</span>" +
          '<span class="marca" style="font-size:22px">@hombre.catolico</span>' +
        "</div>" +
      "</div>";
  }

  // Devuelve el HTML interno para una pieza de cita. El contenedor debe tener class="hc-canvas cita".
  function citaHTML(pieza) {
    var bg = pieza.arte && pieza.arte.archivo ? "background-image:url('/assets/arte/" + esc(pieza.arte.archivo) + "')" : "";
    return "" +
      '<div class="arte" style="' + bg + '"></div>' +
      '<div class="velo"></div>' +
      '<div class="marco"></div>' +
      '<div class="contenido">' +
        '<div class="fila"><span class="cruz">✠</span></div>' +
        '<div class="push"></div>' +
        '<div class="comilla">“</div>' +
        '<blockquote class="cita-texto gap-s">' + esc(pieza.cita) + "</blockquote>" +
        '<div class="autor gap-l">' + esc(pieza.autor) + "</div>" +
        (pieza.fuente ? '<div class="fuente gap-s">' + esc(pieza.fuente) + "</div>" : "") +
        '<div class="push"></div>' +
        '<div class="fila">' +
          '<span class="marca grow">@hombre.catolico</span>' +
          (pieza.credito_obra ? '<span class="fuente">' + esc(pieza.credito_obra) + "</span>" : "") +
        "</div>" +
      "</div>";
  }

  global.HC = { esc: esc, slideHTML: slideHTML, citaHTML: citaHTML };
})(typeof window !== "undefined" ? window : globalThis);
