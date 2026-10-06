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
      var text = "Hola Grupo Lopval, soy " + d.get("nombre") +
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
    safe(initFilters, "filters");
    safe(initTilt, "tilt");
    safe(initContact, "contact");
    safe(initForm, "form");
    safe(initYear, "year");
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
