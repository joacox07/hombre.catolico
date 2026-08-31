/* Panel móvil: el navegador sólo ve piezas y usa APIs protegidas para generar/descargar. */
(function () {
  "use strict";
  var BASE = (typeof window.SITE_BASE !== "undefined") ? window.SITE_BASE : "/";
  var API = typeof window.HC_API_BASE === "string" ? window.HC_API_BASE.replace(/\/$/, "") : "";
  var LOTE_FALLBACK = "/data/lotes/lote-demo.json";
  var INDICE = "/data/lotes/index.json";
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var ICON = {
    like: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-10-9.3C.6 9 1.7 5.7 4.8 5.1 7 4.7 8.8 6 12 9c3.2-3 4.2-4.3 7.2-3.9 3.1.6 4.2 3.9 2.8 6.6C19.5 16.1 12 21 12 21z"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.2-5.3A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>'
  };
  var lote = null, items = [], sel = 0, slide = 0, polling = null;

  function esc(s) { return window.HC.esc(s); }
  function url(p) { return BASE + String(p).replace(/^\//, ""); }
  function api(path, options) {
    return fetch(API + path, Object.assign({ credentials: "same-origin" }, options || {})).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch (_) { data = { error: res.ok ? "El servidor devolvió una respuesta inválida." : "El servidor devolvió un error. Intentá de nuevo." }; }
        if (!res.ok) { var err = new Error(data.error || "No se pudo completar la acción."); err.status = res.status; throw err; }
        return data;
      });
    });
  }
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
    return parseInt(m[3], 10) + " de " + MESES[parseInt(m[2], 10) - 1] + (m[4] ? " · " + m[4] + ":" + m[5] : "");
  }
  function mostrarLogin(mensaje) {
    document.getElementById("app-shell").hidden = true;
    document.getElementById("login-shell").hidden = false;
    document.getElementById("login-error").textContent = mensaje || "";
  }
  function mostrarPanel() {
    document.getElementById("login-shell").hidden = true;
    document.getElementById("app-shell").hidden = false;
  }
  function estadoGeneracion(texto, error) {
    var el = document.getElementById("generation-status");
    el.textContent = texto || "";
    el.classList.toggle("error", !!error);
  }
  function renderLista() {
    var cont = document.getElementById("lista");
    cont.innerHTML = "";
    items.forEach(function (it, i) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "pieza-card" + (i === sel ? " activa" : "");
      var thumb = document.createElement("div"); thumb.className = "thumb"; thumb.appendChild(canvasFor(it.pieza, 0));
      var info = document.createElement("div"); info.className = "info";
      info.innerHTML = '<div class="tit">' + esc(it.pieza.tema || it.pieza.titulo || it.pieza.id) + "</div>" +
        '<div class="meta-min">' + esc((it.pieza.tipo === "cita" ? "Cita" : "Carrusel") + " · " + (it.meta.estado || "en revisión")) + "</div>";
      card.appendChild(thumb); card.appendChild(info);
      card.addEventListener("click", function () { sel = i; slide = 0; render(); });
      cont.appendChild(card);
    });
  }
  function badge(texto) {
    var text = texto || "estado";
    return '<span class="badge ' + esc(text.toLowerCase().replace(/\s+/g, "_")) + '">' + esc(text) + "</span>";
  }
  function renderDetalle() {
    var it = items[sel]; if (!it) return;
    var pieza = it.pieza, meta = it.meta, total = slideCount(pieza);
    if (slide >= total) slide = 0;
    var post = document.createElement("div"); post.className = "ig-post";
    post.innerHTML = '<div class="ig-head"><div class="ig-avatar">H</div><div class="u">hombre.catolico<small>Publicación sugerida</small></div><div class="dots">•••</div></div>' +
      '<div class="ig-media" id="media"></div>' + (total > 1 ? '<div class="ig-dots" id="dots"></div>' : "") +
      '<div class="ig-actions">' + ICON.like + ICON.comment + ICON.share + '<span class="sp"></span>' + ICON.save + "</div>" +
      '<div class="ig-caption" id="caption"></div>';
    var rev = meta.revisor || {};
    var clasif = (pieza.clasificacion_doctrinal || []).map(function (c) {
      return '<div class="v">· ' + esc(c.afirmacion) + ' <span class="nivel">[nivel ' + esc(c.nivel) + " · " + esc(c.etiqueta) + "]</span></div>";
    }).join("");
    var fuentes = (pieza.fuentes || []).map(function (f) { return '<span class="chip">' + esc(f) + "</span>"; }).join("");
    var descarga = API && lote && lote.id ? '<div class="acciones"><a class="download" href="' + esc(API + "/downloads/" + encodeURIComponent(lote.id) + "/" + encodeURIComponent(pieza.id)) + '">Descargar ZIP</a></div>' : "";
    var metaEl = document.createElement("div"); metaEl.className = "meta";
    metaEl.innerHTML = "<h3>" + esc(pieza.titulo || pieza.tema || pieza.id) + "</h3>" +
      '<div class="tema">' + esc((pieza.pilar ? pieza.pilar + " · " : "") + (pieza.tema || "")) + "</div>" + descarga +
      '<div class="row"><div class="k">Estado</div><div class="v">' + badge(meta.estado) + "</div></div>" +
      '<div class="row"><div class="k">Fecha propuesta</div><div class="v">' + esc(fechaLinda(meta.fecha_propuesta)) + "</div></div>" +
      '<div class="row"><div class="k">Revisor sacerdote</div><div class="v">' + badge(rev.veredicto) +
        (rev.requiere_revision_humana ? " " + badge("revision_humana") : "") + (rev.nota ? '<div class="v" style="margin-top:6px">' + esc(rev.nota) + "</div>" : "") + "</div></div>" +
      '<div class="row"><div class="k">Citas verificadas</div><div class="v">' + (rev.citas_verificadas ? "Sí" : '<span class="warn-line">No — verificar antes de publicar</span>') + "</div></div>" +
      (clasif ? '<div class="row"><div class="k">Clasificación doctrinal</div>' + clasif + "</div>" : "") +
      (fuentes ? '<div class="row"><div class="k">Fuentes</div><div class="v">' + fuentes + "</div></div>" : "");
    var cont = document.getElementById("detalle"); cont.innerHTML = ""; cont.appendChild(post); cont.appendChild(metaEl);
    pintarMedia(); pintarCaption();
  }
  function escalarMedia() {
    var media = document.getElementById("media"), canvas = media && media.querySelector(".hc-canvas");
    if (media && canvas) canvas.style.transform = "scale(" + (media.clientWidth / 1080) + ")";
  }
  function pintarMedia() {
    var it = items[sel], pieza = it.pieza, total = slideCount(pieza), media = document.getElementById("media");
    media.innerHTML = ""; media.appendChild(canvasFor(pieza, slide)); escalarMedia();
    if (total > 1) {
      var prev = document.createElement("button"); prev.type = "button"; prev.className = "nav prev"; prev.textContent = "‹"; prev.disabled = slide === 0;
      prev.addEventListener("click", function () { if (slide > 0) { slide--; pintarMedia(); pintarDots(); } });
      var next = document.createElement("button"); next.type = "button"; next.className = "nav next"; next.textContent = "›"; next.disabled = slide === total - 1;
      next.addEventListener("click", function () { if (slide < total - 1) { slide++; pintarMedia(); pintarDots(); } });
      var contador = document.createElement("div"); contador.className = "contador"; contador.textContent = (slide + 1) + "/" + total;
      media.appendChild(prev); media.appendChild(next); media.appendChild(contador);
    }
    pintarDots();
  }
  function pintarDots() {
    var dots = document.getElementById("dots"); if (!dots) return; dots.innerHTML = "";
    for (var i = 0; i < slideCount(items[sel].pieza); i++) { var dot = document.createElement("i"); if (i === slide) dot.className = "on"; dots.appendChild(dot); }
  }
  function pintarCaption() {
    var it = items[sel], pieza = it.pieza, cap = document.getElementById("caption"), texto = pieza.caption || "", corto = texto.length > 140 ? texto.slice(0, 140) + "…" : texto;
    cap.innerHTML = '<span class="u">hombre.catolico</span><span class="txt">' + esc(corto) + '</span><span class="fecha">' + esc(fechaLinda(it.meta.fecha_propuesta)) + "</span>";
  }
  function render() { renderLista(); renderDetalle(); }
  function resolverLoteLocal() {
    var qs = new URLSearchParams(location.search).get("lote");
    if (qs) return Promise.resolve(qs.indexOf("/") === 0 ? qs : "/data/lotes/" + qs);
    return fetch(url(INDICE)).then(function (r) { return r.ok ? r.json() : null; }).then(function (idx) { return idx && idx.lotes && idx.lotes[0] ? idx.lotes[0].file : LOTE_FALLBACK; });
  }
  function cargarLote() {
    var carga = API ? api("/lotes/latest") : resolverLoteLocal().then(function (loteUrl) {
      return fetch(url(loteUrl)).then(function (r) { return r.json(); }).then(function (l) {
        return Promise.all(l.piezas.map(function (meta) { return fetch(url(meta.ref)).then(function (r) { return r.json(); }).then(function (pieza) { return { meta: meta, pieza: pieza }; }); })).then(function (piezas) { return { lote: l, piezas: piezas }; });
      });
    });
    return carga.then(function (datos) {
      lote = datos.lote; items = datos.piezas; sel = 0; slide = 0; mostrarPanel();
      document.getElementById("lote-info").textContent = lote.nombre + " · " + lote.semana + " · " + items.length + " piezas";
      render();
    }).catch(function (error) {
      if (API && error.status === 401) { mostrarLogin(); return; }
      mostrarPanel(); document.getElementById("detalle").innerHTML = '<div class="meta">No se pudo cargar el lote. Intentá de nuevo.</div>';
    });
  }
  function seguirGeneracion(solicitud) {
    clearInterval(polling);
    function consultar() {
      api("/generations/" + encodeURIComponent(solicitud)).then(function (estado) {
        if (estado.estado === "completed") {
          clearInterval(polling); document.getElementById("generar").disabled = false;
          if (estado.resultado === "success") { estadoGeneracion("Lote listo. Actualizando…"); cargarLote().then(function () { estadoGeneracion("Lote nuevo listo para revisar y descargar."); }); }
          else estadoGeneracion("La generación no terminó correctamente. Intentá de nuevo.", true);
          return;
        }
        estadoGeneracion(estado.estado === "queued" ? "La generación está en cola…" : "Generando texto, imágenes y ZIPs…");
      }).catch(function () { clearInterval(polling); document.getElementById("generar").disabled = false; estadoGeneracion("No se pudo consultar la generación.", true); });
    }
    consultar(); polling = window.setInterval(consultar, 5000);
  }
  function init() {
    document.getElementById("password-toggle").addEventListener("click", function () {
      var input = document.getElementById("password");
      var visible = input.type === "text";
      input.type = visible ? "password" : "text";
      this.textContent = visible ? "Mostrar" : "Ocultar";
      this.setAttribute("aria-pressed", String(!visible));
    });
    document.getElementById("login-form").addEventListener("submit", function (event) {
      event.preventDefault(); var password = document.getElementById("password").value;
      api("/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) }).then(function () { document.getElementById("password").value = ""; cargarLote(); }).catch(function (error) { document.getElementById("login-error").textContent = error.message; });
    });
    document.getElementById("logout").addEventListener("click", function () { if (API) api("/session", { method: "DELETE" }).finally(function () { clearInterval(polling); mostrarLogin(); }); });
    document.getElementById("generar").addEventListener("click", function () {
      var boton = this; boton.disabled = true; estadoGeneracion("Iniciando generación…");
      api("/generations", { method: "POST" }).then(function (data) { seguirGeneracion(data.solicitud); }).catch(function (error) { boton.disabled = false; estadoGeneracion(error.message, true); });
    });
    window.addEventListener("resize", escalarMedia);
    if (!API) { document.getElementById("logout").hidden = true; document.getElementById("generar").hidden = true; }
    cargarLote();
  }
  init();
})();
