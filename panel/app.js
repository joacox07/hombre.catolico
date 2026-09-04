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
  var lote = null, items = [], historial = [], revision = null, sel = 0, slide = 0, polling = null;

  function esc(s) { return window.HC.esc(s); }
  function url(p) { return BASE + String(p).replace(/^\//, ""); }
  function api(path, options) {
    var method = String(options && options.method || "GET").toUpperCase();
    if (method !== "GET" && !navigator.onLine) {
      return Promise.reject(new Error("Sin conexión. Esta acción se habilita cuando vuelva internet."));
    }
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 30000) : null;
    return fetch(API + path, Object.assign({ credentials: "same-origin" }, options || {}, controller ? { signal: controller.signal } : {})).catch(function (error) {
      if (error && error.name === "AbortError") throw new Error("La operación tardó demasiado. Reintentá en unos segundos.");
      throw new Error("No pudimos conectarnos con el servicio. Verificá tu conexión e intentá de nuevo.");
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try { data = text ? JSON.parse(text) : {}; }
        catch (_) { data = { error: res.ok ? "El servidor devolvió una respuesta inválida." : "El servidor devolvió un error. Intentá de nuevo." }; }
        if (!res.ok) { var err = new Error(data.error || "No se pudo completar la acción."); err.status = res.status; throw err; }
        return data;
      });
    }).finally(function () { if (timeout !== null) window.clearTimeout(timeout); });
  }
  function descripcionVistaPrevia(pieza, slideIdx) {
    var total = pieza.tipo === "cita" ? 1 : (pieza.slides || []).length;
    var titulo = pieza.titulo || pieza.tema || pieza.id || "Pieza editorial";
    return "Vista previa: " + titulo + (total > 1 ? ", diapositiva " + ((slideIdx || 0) + 1) + " de " + total : "");
  }
  function canvasFor(pieza, slideIdx) {
    var el = document.createElement("div");
    el.className = "hc-canvas";
    el.innerHTML = pieza.tipo === "cita" ? window.HC.citaHTML(pieza) : window.HC.slideHTML(pieza, slideIdx || 0);
    el.setAttribute("aria-hidden", "true");
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
    document.getElementById("login-form").reset();
    var input = document.getElementById("password"), toggle = document.getElementById("password-toggle");
    input.type = "password"; toggle.textContent = "Mostrar"; toggle.setAttribute("aria-pressed", "false");
    document.getElementById("login-error").textContent = mensaje || "";
    window.scrollTo(0, 0);
  }
  function mostrarPanel() {
    document.getElementById("login-shell").hidden = true;
    document.getElementById("app-shell").hidden = false;
    window.scrollTo(0, 0);
  }
  function estadoGeneracion(texto, error) {
    var el = document.getElementById("generation-status");
    el.textContent = texto || "";
    el.classList.toggle("error", !!error);
  }
  function actualizarConexion() {
    var sinConexion = !navigator.onLine;
    var aviso = document.getElementById("network-status");
    if (aviso) {
      aviso.hidden = !sinConexion;
      aviso.textContent = sinConexion ? "Sin conexión: podés revisar el último lote guardado. Las acciones se reactivarán al volver internet." : "";
    }
    document.body.classList.toggle("offline", sinConexion);
    var generar = document.getElementById("generar");
    if (generar) generar.disabled = sinConexion;
  }
  function limpiarDatosOffline() {
    if (navigator.serviceWorker) navigator.serviceWorker.ready.then(function (registro) {
      if (registro.active) registro.active.postMessage({ type: "LIMPIAR_DATOS_EDITORIAL" });
    }).catch(function () {});
  }
  function registrarPWA() {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  function ayudaInstalacion() {
    estadoGeneracion("En iPhone: tocá Compartir en Safari y elegí “Agregar a pantalla de inicio”.");
  }
  function revisionDe(piezaId) {
    return revision && revision.contenido && revision.contenido.revisiones ? revision.contenido.revisiones[piezaId] || null : null;
  }
  function estadoDe(meta, pieza) {
    var decision = revisionDe(pieza.id);
    if (!decision) return meta.estado || "en_revision";
    return decision.decision === "aprobar" ? "aprobado" : decision.decision === "cambios" ? "cambios" : "descartado";
  }
  function aprobable(control) {
    var c = control && control.candados;
    return !!(c && c.citas_literales && c.fuentes_verificadas && c.arte_procedencia && c.render_tecnico === true && !control.bloquea_aprobacion);
  }
  function renderLista() {
    var cont = document.getElementById("lista");
    cont.innerHTML = "";
    items.forEach(function (it, i) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "pieza-card" + (i === sel ? " activa" : "");
      card.setAttribute("aria-current", i === sel ? "true" : "false");
      var thumb = document.createElement("div"); thumb.className = "thumb"; thumb.appendChild(canvasFor(it.pieza, 0));
      var info = document.createElement("div"); info.className = "info";
      info.innerHTML = '<div class="tit">' + esc(it.pieza.tema || it.pieza.titulo || it.pieza.id) + "</div>" +
        '<div class="meta-min">' + esc((it.pieza.tipo === "cita" ? "Cita" : "Carrusel") + " · " + estadoDe(it.meta, it.pieza).replace(/_/g, " ")) + "</div>";
      card.appendChild(thumb); card.appendChild(info);
      card.addEventListener("click", function () { sel = i; slide = 0; render(); });
      cont.appendChild(card);
    });
  }
  function etiquetaLote(resumen) {
    var identificador = String(resumen.id || "").replace(/^\d{4}-W\d{2}-?/, "");
    var piezas = typeof resumen.piezas === "number" ? " · " + resumen.piezas + " piezas" : "";
    return (resumen.generado ? fechaLinda(resumen.generado) + " · " : "") + (resumen.nombre || resumen.semana || "Lote") + piezas + (identificador ? " · #" + identificador : "");
  }
  function renderHistorial() {
    var select = document.getElementById("lote-select");
    select.innerHTML = "";
    historial.forEach(function (resumen) {
      var option = document.createElement("option");
      option.value = resumen.id;
      option.textContent = etiquetaLote(resumen);
      option.selected = !!lote && resumen.id === lote.id;
      select.appendChild(option);
    });
  }
  function badge(texto) {
    var text = texto || "estado";
    return '<span class="badge ' + esc(text.toLowerCase().replace(/\s+/g, "_")) + '">' + esc(text) + "</span>";
  }
  function controlCalidadHTML(control) {
    if (!control) return '<div class="row"><div class="k">Control de calidad</div><div class="v"><span class="warn-line">No existe informe de calidad para esta pieza.</span></div></div>';
    var c = control.candados || {};
    var candados = [
      ["Citas", c.citas_literales], ["Fuentes", c.fuentes_verificadas], ["Arte", c.arte_procedencia],
      ["Render", c.render_tecnico === true],
    ].map(function (entrada) { return '<span class="chip ' + (entrada[1] ? "ok-chip" : "warn-chip") + '">' + esc(entrada[0]) + ': ' + (entrada[1] ? "ok" : "pendiente") + "</span>"; }).join("");
    var alertas = (control.alertas || []).map(function (alerta) {
      return '<li class="' + (alerta.nivel === "bloqueo" ? "bloqueo" : "") + '">' + esc(alerta.detalle) + "</li>";
    }).join("");
    var afirmaciones = (control.afirmaciones || []).filter(function (a) { return a.respaldo === "incierto"; }).length;
    return '<div class="row calidad"><div class="k">Control de calidad</div><div class="v">' + candados +
      (control.revision_humana_requerida ? '<div class="quality-note">Revisión humana requerida.</div>' : "") +
      (afirmaciones ? '<div class="quality-note">Afirmaciones a contrastar: ' + afirmaciones + ".</div>" : "") +
      (alertas ? '<ul class="quality-alerts">' + alertas + "</ul>" : '<div class="quality-note ok">Sin alertas.</div>') + "</div></div>";
  }
  function historialRevisionHTML(piezaId) {
    var eventos = revision && revision.contenido && Array.isArray(revision.contenido.eventos) ? revision.contenido.eventos.filter(function (evento) { return evento.pieza_id === piezaId; }) : [];
    if (!eventos.length) return "";
    return '<div class="row"><div class="k">Historial editorial</div><div class="v"><ul class="revision-history">' + eventos.slice().reverse().map(function (evento) {
      return "<li>" + badge(evento.decision) + " " + esc(evento.comentario || "Sin comentario.") + '<small>' + esc(fechaLinda(evento.fecha)) + "</small></li>";
    }).join("") + "</ul></div></div>";
  }
  function accionesRevisionHTML(pieza) {
    if (!API || !lote || !lote.id) return "";
    var control = pieza.control_calidad;
    return '<div class="revision-actions"><div class="k">Decisión editorial</div>' +
      '<textarea class="revision-comment" aria-label="Comentario editorial" placeholder="Comentario obligatorio para cambios o descarte"></textarea>' +
      '<div class="acciones"><button class="primary approve" type="button"' + (aprobable(control) ? "" : " disabled") + '>Aprobar</button>' +
      '<button class="secondary changes" type="button">Pedir cambios</button><button class="secondary discard" type="button">Descartar</button></div>' +
      '<p class="revision-status" aria-live="polite"></p></div>';
  }
  function arteEditorHTML(pieza) {
    if (!API) return "";
    return '<div class="arte-actions"><div class="k">Dirección de arte</div>' +
      '<p>Buscá obras reutilizables o creá un fondo original desde una referencia.</p>' +
      '<button class="secondary open-arte" type="button">Buscar / crear imagen</button>' +
      (pieza.reel_portada ? '<span class="arte-ready">Portada Reel preparada</span>' : "") + "</div>";
  }
  function comprimirImagen(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { reject(new Error("Usá PNG, JPG o WebP.")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer la referencia.")); };
      reader.onload = function () {
        var imagen = new Image();
        imagen.onerror = function () { reject(new Error("No se pudo abrir la referencia.")); };
        imagen.onload = function () {
          var intentos = [[960, .76], [720, .72], [560, .68]];
          var data = "";
          for (var i = 0; i < intentos.length; i++) {
            var escala = Math.min(1, intentos[i][0] / Math.max(imagen.width, imagen.height));
            var canvas = document.createElement("canvas"); canvas.width = Math.round(imagen.width * escala); canvas.height = Math.round(imagen.height * escala);
            canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);
            data = canvas.toDataURL("image/jpeg", intentos[i][1]);
            if (Math.floor((data.split(",")[1].length * 3) / 4) <= 360000) break;
          }
          if (!data || Math.floor((data.split(",")[1].length * 3) / 4) > 360000) { reject(new Error("No se pudo comprimir la referencia para usarla desde el celular.")); return; }
          resolve(data);
        };
        imagen.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function abrirArte(pieza, item) {
    var focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    var modal = document.createElement("div"); modal.className = "arte-modal";
    modal.innerHTML = '<div class="arte-dialog" role="dialog" aria-modal="true" aria-labelledby="arte-title">' +
      '<button class="arte-close" type="button" aria-label="Cerrar">×</button><p class="eyebrow">Dirección de arte</p><h2 id="arte-title">Buscar / crear imagen</h2>' +
      '<p class="arte-intro">La búsqueda combina tu pedido con el tema, el guion y la estética de la cuenta. Sólo propone obras con licencia verificable.</p>' +
      '<label>Destino<select class="arte-destino"><option value="post">Post 4:5</option><option value="reel">Portada Reel 9:16</option></select></label>' +
      '<label>Idea o escena<textarea class="arte-consulta" placeholder="Ej.: sacerdote acompañando a un hombre que discierne una decisión"></textarea></label>' +
      '<fieldset class="arte-filters"><legend>Filtrar obras</legend><label>Licencia<select class="arte-licencia"><option value="todas">Todas las verificadas</option><option value="dominio_publico">Dominio público / CC0</option><option value="creative_commons">Creative Commons</option></select></label><label>Encuadre<select class="arte-orientacion"><option value="todas">Cualquier orientación</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="cuadrada">Cuadrada</option></select></label><label>Tipo<select class="arte-tipo"><option value="todos">Todo tipo</option><option value="pintura">Pintura</option><option value="grabado">Grabado</option><option value="arquitectura">Arquitectura</option><option value="escultura">Escultura</option><option value="fotografia">Fotografía</option></select></label><label class="arte-check"><input class="arte-alta-resolucion" type="checkbox" /> Sólo alta resolución</label></fieldset>' +
      '<section class="arte-search-section"><h3>1. Buscar obra existente</h3><p>Primero elegí una obra y revisá el encuadre antes de guardarla.</p><button class="secondary arte-search" type="button">Buscar arte con licencia verificada</button></section>' +
      '<section class="arte-generate-section"><h3>2. Crear imagen original</h3><p>Para escenas que no existen en una obra histórica. Nunca para un santo concreto.</p><label>Hasta 3 referencias autorizadas (opcionales)<input class="arte-referencias" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label><label class="arte-check"><input class="arte-derechos" type="checkbox" /> Tengo derecho a usar estas referencias para orientar una creación original.</label><p class="arte-legal">Las referencias se comprimen, se usan una sola vez y no se guardan. Pinterest nunca se descarga ni se publica desde acá.</p><button class="primary arte-generate" type="button">Generar imagen original</button></section>' +
      '<p class="arte-status" aria-live="polite"></p><div class="arte-preview" aria-live="polite"></div><div class="arte-results"></div></div>';
    document.body.appendChild(modal);
    var refs = [], input = modal.querySelector(".arte-referencias"), status = modal.querySelector(".arte-status"), results = modal.querySelector(".arte-results"), preview = modal.querySelector(".arte-preview"), seleccion = null, ocupado = false;
    function cerrar() {
      modal.remove();
      if (focoAnterior) focoAnterior.focus();
    }
    function focos() {
      return Array.prototype.slice.call(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    }
    function datos() {
      var consulta = modal.querySelector(".arte-consulta").value.trim();
      return { lote_id: lote.id, pieza_id: pieza.id, version: item.version, destino: modal.querySelector(".arte-destino").value, consulta: consulta, referencias: refs, derechos_referencias: modal.querySelector(".arte-derechos").checked, filtros: { licencia: modal.querySelector(".arte-licencia").value, orientacion: modal.querySelector(".arte-orientacion").value, tipo: modal.querySelector(".arte-tipo").value, alta_resolucion: modal.querySelector(".arte-alta-resolucion").checked } };
    }
    function ocupar(valor) {
      ocupado = valor;
      Array.prototype.forEach.call(modal.querySelectorAll(".arte-search, .arte-generate, [data-preview], [data-use]"), function (boton) { boton.disabled = valor; });
    }
    function error(error) {
      ocupar(false);
      status.textContent = error.message || "No se pudo completar la acción.";
      status.classList.add("error");
      if (!navigator.onLine) {
        status.textContent = "Se cortó la conexión. Al volver, voy a recargar la pieza por si el guardado alcanzó el servidor.";
        window.addEventListener("online", function recuperarGuardado() {
          cargarLote(lote.id).catch(function () {});
        }, { once: true });
      }
    }
    function esperando(texto) { status.classList.remove("error"); status.textContent = texto; }
    function aplicar(candidato) {
      if (ocupado) return;
      ocupar(true);
      esperando("Guardando imagen y preparando render…");
      api("/arte/aplicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign(datos(), { candidato: candidato })) })
        .then(function (respuesta) { seguirRenderArte(respuesta.solicitud, status, cerrar); }).catch(error);
    }
    function mostrarEncuadre(candidato) {
      seleccion = candidato;
      var destino = modal.querySelector(".arte-destino").value;
      var proporcion = destino === "reel" ? "reel" : "post";
      preview.innerHTML = '<section class="arte-preview-card"><div class="arte-crop arte-crop-' + proporcion + '"><img src="' + esc(candidato.thumbnail_url) + '" alt="Vista previa de recorte: ' + esc(candidato.titulo) + '" /><span>Zona segura para texto</span></div><div><strong>Encuadre previsto</strong><p>' + esc(candidato.orientacion || "orientación no indicada") + (candidato.ancho && candidato.alto ? " · " + esc(candidato.ancho) + "×" + esc(candidato.alto) : "") + '. El render final vuelve a validar el resultado.</p><button class="primary" type="button" data-use="' + esc(candidato.id) + '">Usar esta obra y preparar render</button></div></section>';
      preview.querySelector("[data-use]").addEventListener("click", function () { aplicar({ tipo: "wikimedia", id: candidato.id }); });
      Array.prototype.forEach.call(results.querySelectorAll(".arte-candidate"), function (tarjeta) { tarjeta.classList.toggle("selected", tarjeta.getAttribute("data-candidato") === candidato.id); });
    }
    function mostrarResultados(respuesta) {
      var candidatos = respuesta.candidatos || [];
      var sugerencias = (respuesta.consultas || []).map(function (consulta) {
        return '<button class="secondary arte-suggestion" type="button" data-consulta="' + esc(consulta) + '">' + esc(consulta) + "</button>";
      }).join("");
      ocupar(false); esperando(respuesta.aviso || candidatos.length + " obras con licencia verificable encontradas. Elegí una para revisar su encuadre.");
      results.innerHTML = candidatos.map(function (candidato) {
        var ficha = [candidato.fuente || "Wikimedia Commons", candidato.periodo, candidato.ancho && candidato.alto ? candidato.ancho + "×" + candidato.alto : "Resolución no indicada", candidato.orientacion, candidato.tipo].filter(Boolean).join(" · ");
        return '<article class="arte-candidate" data-candidato="' + esc(candidato.id) + '"><img src="' + esc(candidato.thumbnail_url) + '" alt="' + esc(candidato.titulo) + '" /><div><strong>' + esc(candidato.titulo) + '</strong><small>' + esc(candidato.autor || "Autor no indicado") + " · " + esc(candidato.licencia) + '</small><small>' + esc(ficha) + '</small><p>' + esc(candidato.razon) + '</p><a href="' + esc(candidato.fuente_url) + '" target="_blank" rel="noopener">Abrir fuente original</a><button class="secondary" type="button" data-preview="' + esc(candidato.id) + '">Ver encuadre</button></div></article>';
      }).join("") + (!candidatos.length && sugerencias ? '<div class="arte-suggestions"><strong>Probá con:</strong><div>' + sugerencias + "</div></div>" : "");
      Array.prototype.forEach.call(results.querySelectorAll("[data-preview]"), function (boton) { boton.addEventListener("click", function () { mostrarEncuadre(candidatos.find(function (candidato) { return candidato.id === boton.getAttribute("data-preview"); })); }); });
      Array.prototype.forEach.call(results.querySelectorAll("[data-consulta]"), function (boton) { boton.addEventListener("click", function () { modal.querySelector(".arte-consulta").value = this.getAttribute("data-consulta"); buscar(); }); });
    }
    function buscar() {
      if (ocupado) return;
      preview.innerHTML = ""; seleccion = null; ocupar(true); esperando("Interpretando la pieza y buscando obras con licencia verificable…"); results.innerHTML = "";
      api("/arte/buscar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos()) }).then(mostrarResultados).catch(error);
    }
    input.addEventListener("change", function () {
      var archivos = Array.prototype.slice.call(input.files || []);
      if (archivos.length > 3) { refs = []; input.value = ""; error(new Error("Elegí hasta tres referencias.")); return; }
      esperando("Preparando referencias…");
      Promise.all(archivos.map(comprimirImagen)).then(function (imagenes) { refs = imagenes; esperando(refs.length ? refs.length + " referencia(s) lista(s)." : ""); }).catch(function (e) { refs = []; error(e); });
    });
    modal.querySelector(".arte-close").addEventListener("click", cerrar);
    modal.addEventListener("click", function (event) { if (event.target === modal) cerrar(); });
    modal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); cerrar(); return; }
      if (event.key !== "Tab") return;
      var elementos = focos();
      if (!elementos.length) return;
      var primero = elementos[0], ultimo = elementos[elementos.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    });
    modal.querySelector(".arte-close").focus();
    modal.querySelector(".arte-search").addEventListener("click", buscar);
    modal.querySelector(".arte-generate").addEventListener("click", function () {
      if (ocupado) return;
      ocupar(true); esperando("Generando una alternativa original y preparando su render…"); results.innerHTML = ""; preview.innerHTML = "";
      api("/arte/generar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos()) }).then(function (respuesta) {
        seguirRenderArte(respuesta.solicitud, status, cerrar);
      }).catch(error);
    });
  }
  function seguirRenderArte(solicitud, status, cerrar) {
    clearInterval(polling);
    var inicio = Date.now();
    function consultar() {
      api("/arte/" + encodeURIComponent(solicitud)).then(function (estado) {
        if (estado.estado === "completed") {
          clearInterval(polling);
          if (estado.resultado === "success") { status.textContent = "Render listo. Actualizando pieza…"; cargarLote(lote.id).then(function () { status.textContent = "Imagen aplicada."; cerrar(); }); }
          else { status.textContent = "El render no terminó correctamente."; status.classList.add("error"); }
          return;
        }
        if (Date.now() - inicio > 180000) {
          clearInterval(polling);
          status.textContent = "El guardado fue aceptado, pero no pude confirmar el render. Recargá la pieza para verificarlo.";
          status.classList.add("error");
          return;
        }
        status.classList.remove("error"); status.textContent = estado.estado === "queued" ? "Render en cola…" : "Renderizando y preparando descarga…";
      }).catch(function (error) {
        clearInterval(polling);
        status.textContent = error.message;
        status.classList.add("error");
        if (!navigator.onLine) window.addEventListener("online", function () { cargarLote(lote.id).catch(function () {}); }, { once: true });
      });
    }
    consultar(); polling = window.setInterval(consultar, 5000);
  }
  function renderDetalle() {
    var it = items[sel]; if (!it) return;
    var pieza = it.pieza, meta = it.meta, total = slideCount(pieza), estadoActual = estadoDe(meta, pieza);
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
    var caption = (pieza.caption || "").trim();
    var editorCaption = caption ? '<div class="caption-editor"><div class="k">Descripción para Instagram</div><textarea readonly aria-label="Descripción para Instagram">' + esc(caption) + '</textarea><button class="secondary" type="button">Copiar descripción</button><p class="copy-status" aria-live="polite"></p></div>' : "";
    var metaEl = document.createElement("div"); metaEl.className = "meta";
    metaEl.innerHTML = "<h3>" + esc(pieza.titulo || pieza.tema || pieza.id) + "</h3>" +
      '<div class="tema">' + esc((pieza.pilar ? pieza.pilar + " · " : "") + (pieza.tema || "")) + "</div>" + descarga + editorCaption +
      '<div class="row"><div class="k">Estado</div><div class="v">' + badge(estadoActual) + "</div></div>" +
      '<div class="row"><div class="k">Fecha propuesta</div><div class="v">' + esc(fechaLinda(meta.fecha_propuesta)) + "</div></div>" +
      '<div class="row"><div class="k">Revisor sacerdote</div><div class="v">' + badge(rev.veredicto) +
        (rev.requiere_revision_humana ? " " + badge("revision_humana") : "") + (rev.nota ? '<div class="v" style="margin-top:6px">' + esc(rev.nota) + "</div>" : "") + "</div></div>" +
      '<div class="row"><div class="k">Citas verificadas</div><div class="v">' + (rev.citas_verificadas ? "Sí" : '<span class="warn-line">No — verificar antes de publicar</span>') + "</div></div>" +
      controlCalidadHTML(pieza.control_calidad) + arteEditorHTML(pieza) + accionesRevisionHTML(pieza) + historialRevisionHTML(pieza.id) +
      (clasif ? '<div class="row"><div class="k">Clasificación doctrinal</div>' + clasif + "</div>" : "") +
      (fuentes ? '<div class="row"><div class="k">Fuentes</div><div class="v">' + fuentes + "</div></div>" : "");
    if (caption) {
      var areaCaption = metaEl.querySelector("textarea"), botonCopiar = metaEl.querySelector(".caption-editor button"), estadoCopiado = metaEl.querySelector(".copy-status");
      botonCopiar.addEventListener("click", function () { copiarDescripcion(caption, areaCaption, estadoCopiado); });
    }
    if (API) {
      var comentario = metaEl.querySelector(".revision-comment"), estadoRevision = metaEl.querySelector(".revision-status");
      function decidir(decision) {
        var texto = comentario ? comentario.value.trim() : "";
        if ((decision === "cambios" || decision === "descartar") && !texto) {
          estadoRevision.textContent = "Escribí el motivo antes de guardar."; estadoRevision.classList.add("error"); return;
        }
        estadoRevision.classList.remove("error"); estadoRevision.textContent = "Guardando decisión…";
        api("/lotes/" + encodeURIComponent(lote.id) + "/revisiones", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pieza_id: pieza.id, decision: decision, comentario: texto, version: revision && revision.version || null }),
        }).then(function (nuevaRevision) {
          revision = nuevaRevision; render();
        }).catch(function (error) {
          estadoRevision.textContent = error.message; estadoRevision.classList.add("error");
        });
      }
      var aprobar = metaEl.querySelector(".approve"), cambios = metaEl.querySelector(".changes"), descartar = metaEl.querySelector(".discard");
      if (aprobar) aprobar.addEventListener("click", function () { decidir("aprobar"); });
      if (cambios) cambios.addEventListener("click", function () { decidir("cambios"); });
      if (descartar) descartar.addEventListener("click", function () { decidir("descartar"); });
      var abrir = metaEl.querySelector(".open-arte");
      if (abrir) abrir.addEventListener("click", function () { abrirArte(pieza, it); });
    }
    var cont = document.getElementById("detalle"); cont.innerHTML = ""; cont.appendChild(post); cont.appendChild(metaEl);
    sincronizarDock(pieza, it);
    pintarMedia(); pintarCaption();
  }
  function sincronizarDock(pieza, item) {
    var dock = document.getElementById("mobile-dock");
    var descarga = document.getElementById("mobile-download");
    if (!dock || !API || !lote || !pieza) return;
    dock.hidden = false;
    descarga.href = API + "/downloads/" + encodeURIComponent(lote.id) + "/" + encodeURIComponent(pieza.id);
    descarga.classList.toggle("disabled", !navigator.onLine);
    dock.dataset.pieza = item && item.pieza && item.pieza.id || "";
  }
  function copiarDescripcion(texto, area, estado) {
    function seleccionar() {
      area.focus(); area.select(); area.setSelectionRange(0, texto.length);
    }
    function fallback() {
      seleccionar();
      try {
        if (document.execCommand("copy")) { estado.textContent = "Descripción copiada."; return; }
      } catch (_) {}
      estado.textContent = "Descripción seleccionada. Copiala desde el menú.";
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(function () { estado.textContent = "Descripción copiada."; }).catch(fallback);
    } else fallback();
  }
  function escalarMedia() {
    var media = document.getElementById("media"), canvas = media && media.querySelector(".hc-canvas");
    if (media && canvas) canvas.style.transform = "scale(" + (media.clientWidth / 1080) + ")";
  }
  function pintarMedia() {
    var it = items[sel], pieza = it.pieza, total = slideCount(pieza), media = document.getElementById("media");
    media.setAttribute("role", "img"); media.setAttribute("aria-label", descripcionVistaPrevia(pieza, slide));
    media.innerHTML = ""; media.appendChild(canvasFor(pieza, slide)); escalarMedia();
    if (total > 1) {
      var prev = document.createElement("button"); prev.type = "button"; prev.className = "nav prev"; prev.textContent = "‹"; prev.setAttribute("aria-label", "Diapositiva anterior"); prev.disabled = slide === 0;
      prev.addEventListener("click", function () { if (slide > 0) { slide--; pintarMedia(); pintarDots(); } });
      var next = document.createElement("button"); next.type = "button"; next.className = "nav next"; next.textContent = "›"; next.setAttribute("aria-label", "Diapositiva siguiente"); next.disabled = slide === total - 1;
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
  function cargarHistorial() {
    if (API) return api("/lotes").then(function (datos) { historial = datos.lotes || []; renderHistorial(); });
    return fetch(url(INDICE)).then(function (r) { return r.ok ? r.json() : null; }).then(function (idx) {
      historial = (idx && idx.lotes || []).map(function (resumen) { return { id: resumen.id || resumen.semana, nombre: resumen.nombre, semana: resumen.semana, generado: resumen.generado, file: resumen.file }; });
      renderHistorial();
    });
  }
  function resolverLoteLocal(loteId) {
    return fetch(url(INDICE)).then(function (r) { return r.ok ? r.json() : null; }).then(function (idx) {
      var resumenes = idx && idx.lotes || [];
      var seleccionado = loteId && resumenes.find(function (item) { return (item.id || item.semana) === loteId; });
      return seleccionado ? seleccionado.file : (resumenes[0] ? resumenes[0].file : LOTE_FALLBACK);
    });
  }
  function cargarLote(loteId) {
    var carga = API ? api(loteId ? "/lotes/" + encodeURIComponent(loteId) : "/lotes/latest") : resolverLoteLocal(loteId).then(function (loteUrl) {
      return fetch(url(loteUrl)).then(function (r) { return r.json(); }).then(function (l) {
        return Promise.all(l.piezas.map(function (meta) { return fetch(url(meta.ref)).then(function (r) { return r.json(); }).then(function (pieza) { return { meta: meta, pieza: pieza }; }); })).then(function (piezas) { return { lote: l, piezas: piezas }; });
      });
    });
    return carga.then(function (datos) {
      lote = datos.lote; items = datos.piezas; revision = datos.revision || null; sel = 0; slide = 0; mostrarPanel();
      document.getElementById("lote-info").textContent = lote.nombre + " · " + lote.semana + " · " + items.length + " piezas";
      renderHistorial();
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
          if (estado.resultado === "success") { estadoGeneracion("Lote listo. Actualizando…"); cargarHistorial().then(function () { return cargarLote(); }).then(function () { estadoGeneracion("Lote nuevo listo para revisar y descargar."); }); }
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
      api("/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: password }) }).then(function () {
        document.getElementById("password").value = "";
        return cargarHistorial();
      }).then(function () { return cargarLote(); }).catch(function (error) { document.getElementById("login-error").textContent = error.message; });
    });
    document.getElementById("logout").addEventListener("click", function () { if (API) api("/session", { method: "DELETE" }).finally(function () { clearInterval(polling); limpiarDatosOffline(); document.getElementById("mobile-dock").hidden = true; mostrarLogin(); }); });
    document.getElementById("install-help").addEventListener("click", ayudaInstalacion);
    document.getElementById("mobile-dock").addEventListener("click", function (event) {
      var accion = event.target && event.target.getAttribute("data-mobile-action");
      if (accion === "arte" && items[sel]) abrirArte(items[sel].pieza, items[sel]);
      if (accion === "decision") {
        var destino = document.querySelector(".revision-actions");
        if (destino) destino.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    document.getElementById("generar").addEventListener("click", function () {
      var boton = this; boton.disabled = true; estadoGeneracion("Iniciando generación…");
      api("/generations", { method: "POST" }).then(function (data) { seguirGeneracion(data.solicitud); }).catch(function (error) { boton.disabled = false; estadoGeneracion(error.message, true); });
    });
    document.getElementById("lote-select").addEventListener("change", function () { cargarLote(this.value); });
    window.addEventListener("resize", escalarMedia);
    window.addEventListener("online", actualizarConexion);
    window.addEventListener("offline", actualizarConexion);
    if (!API) { document.getElementById("logout").hidden = true; document.getElementById("generar").hidden = true; }
    registrarPWA(); actualizarConexion();
    cargarHistorial().catch(function () {}).then(function () { return cargarLote(); });
  }
  init();
})();
