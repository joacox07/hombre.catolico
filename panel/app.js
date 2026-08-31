/* Panel visor — carga un lote y muestra cada pieza dentro del marco de Instagram.
   Reutiliza el render real (window.HC) de templates/render.js: la previsualización es la pieza. */
(function () {
  "use strict";
  // Base del sitio. Local (servidor en la raíz) = "/". En GitHub Pages el build setea
  // window.SITE_BASE = "" y sirve index.html en la raíz del sitio → rutas relativas.
  var BASE = (typeof window.SITE_BASE !== "undefined") ? window.SITE_BASE : "/";
  function url(p) { return BASE + String(p).replace(/^\//, ""); }
  var LOTE_FALLBACK = "/data/lotes/lote-demo.json";
  var INDICE = "/data/lotes/index.json";
  var MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  var ICON = {
    like: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-10-9.3C.6 9 1.7 5.7 4.8 5.1 7 4.7 8.8 6 12 9c3.2-3 5-4.3 7.2-3.9 3.1.6 4.2 3.9 2.8 6.6C19.5 16.1 12 21 12 21z"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  };

  var lote = null;
  var items = [];      // { meta, pieza }
  var sel = 0;
  var slide = 0;

  function esc(s) { return window.HC.esc(s); }

  function canvasFor(pieza, slideIdx) {
    var el = document.createElement("div");
    el.className = "hc-canvas";
    el.innerHTML = pieza.tipo === "cita" ? window.HC.citaHTML(pieza) : window.HC.slideHTML(pieza, slideIdx || 0);
    return el;
  }

  function slideCount(pieza) { return pieza.tipo === "cita" ? 1 : (pieza.slides || []).length; }

  function fechaLinda(s) {
    if (!s) return "";
    var m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
    if (!m) return s;
    var dia = parseInt(m[3], 10), mes = MESES[parseInt(m[2], 10) - 1];
    var hora = m[4] ? " · " + m[4] + ":" + m[5] : "";
    return dia + " de " + mes + hora;
  }

  function renderLista() {
    var cont = document.getElementById("lista");
    cont.innerHTML = "";
    items.forEach(function (it, i) {
      var card = document.createElement("div");
      card.className = "pieza-card" + (i === sel ? " activa" : "");
      var thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.appendChild(canvasFor(it.pieza, 0));
      var info = document.createElement("div");
      info.className = "info";
      info.innerHTML =
        '<div class="tit">' + esc(it.pieza.tema || it.pieza.titulo || it.pieza.id) + "</div>" +
        '<div class="meta-min">' + esc((it.pieza.tipo === "cita" ? "Cita" : "Carrusel") + " · " + (it.meta.estado || "")) + "</div>";
      card.appendChild(thumb);
      card.appendChild(info);
      card.addEventListener("click", function () { sel = i; slide = 0; render(); });
      cont.appendChild(card);
    });
  }

  function badge(veredicto) {
    var cls = (veredicto || "estado").replace(/\s+/g, "_");
    return '<span class="badge ' + esc(cls) + '">' + esc(veredicto) + "</span>";
  }

  function renderDetalle() {
    var it = items[sel];
    if (!it) return;
    var pieza = it.pieza, meta = it.meta;
    var total = slideCount(pieza);
    if (slide >= total) slide = 0;
    var cont = document.getElementById("detalle");

    // --- Post de Instagram ---
    var post = document.createElement("div");
    post.className = "ig-post";
    post.innerHTML =
      '<div class="ig-head">' +
        '<div class="ig-avatar">H</div>' +
        '<div class="u">hombre.catolico<small>Publicación sugerida</small></div>' +
        '<div class="dots">•••</div>' +
      "</div>" +
      '<div class="ig-media" id="media"></div>' +
      (total > 1 ? '<div class="ig-dots" id="dots"></div>' : "") +
      '<div class="ig-actions">' + ICON.like + ICON.comment + ICON.share + '<span class="sp"></span>' + ICON.save + "</div>" +
      '<div class="ig-caption" id="caption"></div>';

    // --- Metadatos ---
    var rev = meta.revisor || {};
    var clasif = (pieza.clasificacion_doctrinal || []).map(function (c) {
      return '<div class="v">· ' + esc(c.afirmacion) + ' <span class="nivel">[nivel ' + esc(c.nivel) + " · " + esc(c.etiqueta) + "]</span></div>";
    }).join("");
    var fuentes = (pieza.fuentes || []).map(function (f) { return '<span class="chip">' + esc(f) + "</span>"; }).join("");

    var meta_el = document.createElement("div");
    meta_el.className = "meta";
    meta_el.innerHTML =
      "<h3>" + esc(pieza.titulo || pieza.tema || pieza.id) + "</h3>" +
      '<div class="tema">' + esc((pieza.pilar ? pieza.pilar + " · " : "") + (pieza.tema || "")) + "</div>" +
      '<div class="row"><div class="k">Estado</div><div class="v">' + badge(meta.estado) + "</div></div>" +
      '<div class="row"><div class="k">Fecha propuesta</div><div class="v">' + esc(fechaLinda(meta.fecha_propuesta)) + "</div></div>" +
      '<div class="row"><div class="k">Revisor sacerdote</div><div class="v">' + badge(rev.veredicto) +
        (rev.requiere_revision_humana ? " " + badge("revision_humana") : "") +
        (rev.nota ? '<div class="v" style="margin-top:6px">' + esc(rev.nota) + "</div>" : "") + "</div></div>" +
      '<div class="row"><div class="k">Citas verificadas</div><div class="v">' +
        (rev.citas_verificadas ? "Sí" : '<span class="warn-line">No — verificar fichas antes de publicar</span>') + "</div></div>" +
      (clasif ? '<div class="row"><div class="k">Clasificación doctrinal</div>' + clasif + "</div>" : "") +
      (fuentes ? '<div class="row"><div class="k">Fuentes</div><div class="v">' + fuentes + "</div></div>" : "");

    cont.innerHTML = "";
    cont.appendChild(post);
    cont.appendChild(meta_el);

    pintarMedia();
    pintarCaption();
  }

  // Escala el lienzo (1080×1350) al ancho real del contenedor: fluido en cualquier pantalla.
  function escalarMedia() {
    var media = document.getElementById("media");
    if (!media) return;
    var c = media.querySelector(".hc-canvas");
    if (c) c.style.transform = "scale(" + (media.clientWidth / 1080) + ")";
  }

  function pintarMedia() {
    var it = items[sel], pieza = it.pieza, total = slideCount(pieza);
    var media = document.getElementById("media");
    media.innerHTML = "";
    media.appendChild(canvasFor(pieza, slide));
    escalarMedia();
    if (total > 1) {
      var prev = document.createElement("button");
      prev.className = "nav prev"; prev.textContent = "‹"; prev.disabled = slide === 0;
      prev.addEventListener("click", function () { if (slide > 0) { slide--; pintarMedia(); pintarDots(); } });
      var next = document.createElement("button");
      next.className = "nav next"; next.textContent = "›"; next.disabled = slide === total - 1;
      next.addEventListener("click", function () { if (slide < total - 1) { slide++; pintarMedia(); pintarDots(); } });
      var cont = document.createElement("div");
      cont.className = "contador"; cont.textContent = (slide + 1) + "/" + total;
      media.appendChild(prev); media.appendChild(next); media.appendChild(cont);
    }
    pintarDots();
  }

  function pintarDots() {
    var dots = document.getElementById("dots");
    if (!dots) return;
    var total = slideCount(items[sel].pieza);
    dots.innerHTML = "";
    for (var i = 0; i < total; i++) {
      var d = document.createElement("i");
      if (i === slide) d.className = "on";
      dots.appendChild(d);
    }
  }

  function pintarCaption() {
    var it = items[sel], pieza = it.pieza;
    var cap = document.getElementById("caption");
    var texto = pieza.caption || (pieza.tipo === "cita" ? (pieza.cita + "\n— " + pieza.autor) : "");
    var corte = 140;
    var expandido = false;
    function pintar() {
      var visible = (!expandido && texto.length > corte) ? texto.slice(0, corte) + "… " : texto;
      cap.innerHTML =
        '<span class="u">hombre.catolico</span>' +
        '<span class="txt">' + esc(visible) + "</span>" +
        (!expandido && texto.length > corte ? '<span class="mas">más</span>' : "") +
        '<span class="fecha">' + esc(fechaLinda(it.meta.fecha_propuesta)) + "</span>";
      var mas = cap.querySelector(".mas");
      if (mas) mas.addEventListener("click", function () { expandido = true; pintar(); });
    }
    pintar();
  }

  function render() { renderLista(); renderDetalle(); }

  // Resuelve qué lote cargar: ?lote=archivo.json → ese; si no, el más nuevo del índice; si no, el demo.
  function resolverLote() {
    var qs = new URLSearchParams(location.search).get("lote");
    if (qs) return Promise.resolve(qs.indexOf("/") === 0 ? qs : "/data/lotes/" + qs);
    return fetch(url(INDICE))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (idx) { return (idx && idx.lotes && idx.lotes[0]) ? idx.lotes[0].file : LOTE_FALLBACK; })
      .catch(function () { return LOTE_FALLBACK; });
  }

  function init() {
    resolverLote()
      .then(function (loteUrl) { return fetch(url(loteUrl)); })
      .then(function (r) { return r.json(); })
      .then(function (l) {
        lote = l;
        document.getElementById("lote-info").textContent =
          l.nombre + " · " + l.semana + " · " + l.piezas.length + " piezas";
        return Promise.all(l.piezas.map(function (p) {
          return fetch(url(p.ref)).then(function (r) { return r.json(); }).then(function (pieza) {
            return { meta: p, pieza: pieza };
          });
        }));
      })
      .then(function (arr) { items = arr; render(); })
      .catch(function (e) {
        document.getElementById("detalle").innerHTML = '<div class="meta">Error cargando el lote: ' + esc(String(e)) + "</div>";
      });
  }

  window.addEventListener("resize", escalarMedia);
  init();
})();
