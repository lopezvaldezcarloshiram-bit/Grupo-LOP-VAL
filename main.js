(function () {
  "use strict";

  var BRAND = window.__BRAND__ || {};
  var doc = document;

  function safe(fn, name) {
    try { fn(); } catch (err) { if (window.console) console.warn("[lopval] " + name + " falló:", err); }
  }
  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  /* ----- Nav: solid on scroll + mobile menu ----- */
  function initNav() {
    var nav = $("[data-nav]");
    var toggle = $("[data-menu-toggle]");
    if (!nav) return;

    function onScroll() { nav.classList.toggle("is-solid", window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!toggle) return;
    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      doc.body.style.overflow = open ? "hidden" : "";
    }
    toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("is-open")); });
    $$("[data-menu] a").forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ----- Scroll progress bar ----- */
  function initProgress() {
    var bar = $("[data-progress]");
    if (!bar) return;
    var ticking = false;
    function update() {
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ")";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ----- Reveal on scroll (with safety timeout) ----- */
  function initReveal() {
    var items = $$(".reveal:not([data-split])");
    var steps = $("[data-steps]");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      if (steps) steps.classList.add("is-drawn");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(entry.target === steps ? "is-drawn" : "is-visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
    if (steps) io.observe(steps);

    setTimeout(function () {
      items.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-visible");
      });
    }, 6000);
  }

  /* ----- Count-up stats ----- */
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      var start = null, dur = 1400;
      el.textContent = "0";
      function frame(t) {
        if (start === null) start = t;
        var p = Math.min((t - start) / dur, 1);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
    // Hero stats are above the fold: run after the intro fade.
    setTimeout(function () { nums.forEach(run); }, 900);
  }

  /* ----- Hero: mouse-follow glow + ring parallax ----- */
  function initHero() {
    var hero = $(".hero");
    var glow = $("[data-glow]");
    var rings = $("[data-parallax]");
    if (!hero || !glow) return;
    if (window.matchMedia("(hover: none)").matches) return;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5;
      var y = (e.clientY - r.top) / r.height - .5;
      glow.style.transform = "translate(calc(-50% + " + (x * 260) + "px), calc(-50% + " + (y * 200) + "px))";
      if (rings) rings.style.translate = (x * -30) + "px " + (y * -30) + "px";
    });

    if (window.gsap && window.ScrollTrigger && rings) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.to(rings, {
        yPercent: -18, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true }
      });
    }
  }

  /* ----- Hero: 3D extruded logo (Three.js). The flat SVG stays as fallback. ----- */
  function logoShapes(THREE, d) {
    // The traced logo path only uses absolute M, L, C and Z commands.
    var tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) || [];
    var paths = [], cur = null, i = 0, cmd = "";
    function n() { return parseFloat(tokens[i++]); }
    while (i < tokens.length) {
      if (/[MLCZ]/.test(tokens[i])) cmd = tokens[i++];
      if (cmd === "M") { cur = new THREE.Path(); cur.moveTo(n(), -n()); paths.push(cur); cmd = "L"; }
      else if (cmd === "L") cur.lineTo(n(), -n());
      else if (cmd === "C") cur.bezierCurveTo(n(), -n(), n(), -n(), n(), -n());
      else if (cmd === "Z") cmd = "";
      else i++;
    }

    // Even-odd fill: a contour nested inside an odd number of others is a hole.
    var polys = paths.map(function (p) { return p.getPoints(4); });
    function inside(pt, poly) {
      var c = false;
      for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        if ((poly[a].y > pt.y) !== (poly[b].y > pt.y) &&
            pt.x < (poly[b].x - poly[a].x) * (pt.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c;
      }
      return c;
    }
    var parents = polys.map(function (poly, k) {
      return polys.map(function (_, j) { return j; }).filter(function (j) { return j !== k && inside(poly[0], polys[j]); });
    });
    var shapes = {}, result = [];
    paths.forEach(function (p, k) {
      if (parents[k].length % 2 === 0) {
        var shape = new THREE.Shape(polys[k]);
        shapes[k] = shape;
        result.push(shape);
      }
    });
    paths.forEach(function (p, k) {
      if (parents[k].length % 2 === 1) {
        // Immediate parent = the containing solid with the most ancestors.
        var host = parents[k].filter(function (j) { return shapes[j]; })
          .sort(function (a, b) { return parents[b].length - parents[a].length; })[0];
        if (host !== undefined) shapes[host].holes.push(new THREE.Path(polys[k]));
      }
    });
    return result;
  }

  function initHero3D() {
    var THREE = window.THREE;
    var hero = $(".hero");
    var canvas = $("[data-hero-3d]");
    var src = $("#lv-logo path");
    if (!THREE || !hero || !canvas || !src) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (err) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
    camera.position.set(0, 0, 1750);

    var geometry = new THREE.ExtrudeGeometry(logoShapes(THREE, src.getAttribute("d")), {
      depth: 70, bevelEnabled: true, bevelThickness: 6, bevelSize: 3, bevelSegments: 3, curveSegments: 10
    });
    geometry.center();
    var face = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 0.15, roughness: 0.3, emissive: 0x1B2A4A, emissiveIntensity: 0.35 });
    var side = new THREE.MeshStandardMaterial({ color: 0x3A4E7A, metalness: 0.55, roughness: 0.35 });
    var logo = new THREE.Mesh(geometry, [face, side]);
    var group = new THREE.Group();
    group.add(logo);
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(-600, 700, 900);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x7FA2E6, 2.4);
    rim.position.set(900, -300, -600);
    scene.add(rim);
    var fill = new THREE.PointLight(0x9DB4E8, 1.2, 0, 0);
    fill.position.set(0, -500, 600);
    scene.add(fill);

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    hero.classList.add("has-3d");
    try { resize(); renderer.render(scene, camera); }
    catch (err) { hero.classList.remove("has-3d"); throw err; }
    window.addEventListener("resize", resize);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);

    var target = { x: 0, y: 0 }, current = { x: 0, y: 0 };
    if (!window.matchMedia("(hover: none)").matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        target.x = ((e.clientX - r.left) / r.width - .5) * 2;
        target.y = ((e.clientY - r.top) / r.height - .5) * 2;
      });
      hero.addEventListener("pointerleave", function () { target.x = 0; target.y = 0; });
    }

    var visible = true, running = false, t0 = performance.now();
    function frame(now) {
      if (!visible || doc.hidden) { running = false; return; }
      var t = (now - t0) / 1000;
      current.x += (target.x - current.x) * 0.05;
      current.y += (target.y - current.y) * 0.05;
      var scrollTurn = Math.min(window.scrollY / Math.max(hero.offsetHeight, 1), 1);
      group.rotation.y = Math.sin(t * 0.35) * 0.45 + current.x * 0.35 + scrollTurn * 1.2;
      group.rotation.x = Math.sin(t * 0.27) * 0.08 + current.y * 0.18;
      group.position.y = Math.sin(t * 0.8) * 14;
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; requestAnimationFrame(frame); } }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe(hero);
    }
    doc.addEventListener("visibilitychange", function () { if (!doc.hidden) start(); });

    renderer.render(scene, camera);
    start();
  }

  /* ----- Portfolio filter ----- */
  function initFilters() {
    var group = $("[data-filters]");
    var cards = $$("[data-cards] .card");
    if (!group || !cards.length) return;
    group.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-filter]");
      if (!btn) return;
      var f = btn.getAttribute("data-filter");
      $$("button", group).forEach(function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      cards.forEach(function (card) {
        var cats = (card.getAttribute("data-cat") || "").split(" ");
        var show = f === "all" || cats.indexOf(f) !== -1;
        card.classList.toggle("is-hidden", !show);
        if (show) card.classList.add("is-visible");
      });
      // Wide cards only span two columns when shown together with the rest.
      $$(".card--wide").forEach(function (w) { w.style.gridColumn = f === "all" ? "" : "auto"; });
    });
  }

  /* ----- Card tilt on pointer ----- */
  function initTilt() {
    if (window.matchMedia("(hover: none)").matches) return;
    $$("[data-tilt]").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5;
        var y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = "perspective(900px) rotateX(" + (y * -4) + "deg) rotateY(" + (x * 5) + "deg) translateY(-4px)";
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
    });
  }

  /* ----- Contact data from manifest ----- */
  function initContact() {
    var c = BRAND.contact || {};
    var phone = $("[data-contact=phone]");
    var email = $("[data-contact=email]");
    if (phone && c.phone) { phone.textContent = c.phone; phone.href = "tel:" + c.phone.replace(/[^\d+]/g, ""); }
    if (email && c.email) { email.textContent = c.email; email.href = "mailto:" + c.email; }
  }

  /* ----- Contact form: opens WhatsApp or e-mail with the message ----- */
  function initForm() {
    var form = $("[data-form]");
    var note = $("[data-form-note]");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$("[required]", form).forEach(function (input) {
        var bad = !input.value.trim();
        input.closest(".field").classList.toggle("is-invalid", bad);
        if (bad) ok = false;
      });
      if (!ok) { note.textContent = "Completa tu nombre y mensaje, por favor."; return; }

      var d = new FormData(form);
      var text = "Hola Grupo LopVal, soy " + d.get("nombre") +
        (d.get("empresa") ? " de " + d.get("empresa") : "") +
        ".\nMe interesa: " + d.get("interes") + ".\n\n" + d.get("mensaje");
      var c = BRAND.contact || {};

      if (c.whatsapp) {
        window.open("https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent(text), "_blank", "noopener");
        note.textContent = "Abrimos WhatsApp con tu mensaje. ¡Gracias!";
      } else if (c.email) {
        window.location.href = "mailto:" + c.email + "?subject=" + encodeURIComponent("Contacto desde el sitio web") + "&body=" + encodeURIComponent(text);
        note.textContent = "Abrimos tu correo con el mensaje listo para enviar.";
      } else {
        note.textContent = "Muy pronto habilitaremos este formulario. Mientras tanto, usa los datos de contacto.";
      }
    });
  }

  function initYear() {
    var y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  function boot() {
    safe(initNav, "nav");
    safe(initProgress, "progress");
    safe(initReveal, "reveal");
    safe(initCounters, "counters");
    safe(initHero, "hero");
    safe(initHero3D, "hero3d");
    safe(initFilters, "filters");
    safe(initTilt, "tilt");
    safe(initContact, "contact");
    safe(initForm, "form");
    safe(initYear, "year");
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
