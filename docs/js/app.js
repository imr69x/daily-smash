(function () {
  "use strict";
  document.documentElement.classList.add("js");

  // ---------------- utilitaires partagés (utilisés aussi par admin.js) ----------------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPrice(n) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return n.toFixed(2).replace(".", ",") + " €";
  }
  function toast(msg, kind) {
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.setAttribute("role", kind === "err" ? "alert" : "status");
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3800);
  }
  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }
  // Texte accordé au nombre : tout le vocabulaire "burger du moment" est construit ici, à partir du nombre actif.
  function momentCopy(n) {
    var many = n > 1;
    return {
      eyebrow: (many ? "Disponibles" : "Disponible") + " pour une durée limitée",
      title: (many ? "Les burgers" : "Le burger") + " du moment",
      chip: "Du moment"
    };
  }

  // ---------------- logos des réseaux ----------------
  var PLATFORMS = {
    ubereats: { label: "Uber Eats", bg: "#06c167", glyph: '<path d="M7.4 9.5h9.2l-.9 8.5H8.3z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.6 9.5V8.3a2.4 2.4 0 0 1 4.8 0v1.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' },
    facebook: { label: "Facebook", bg: "#1877f2", glyph: '<path d="M13.4 20v-7h2.3l.4-2.8h-2.7V8.5c0-.8.3-1.3 1.4-1.3h1.4V4.7c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2H8.3V13h2.3v7z" fill="#fff"/>' },
    instagram: { label: "Instagram", bg: "linear-gradient(135deg,#f9a03f,#e1306c 55%,#833ab4)", grad: ["#f9a03f", "#e1306c", "#833ab4"], glyph: '<rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.2" cy="7.8" r="1" fill="#fff"/>' },
    tiktok: { label: "TikTok", bg: "#111", glyph: '<path d="M13.8 5v8.4a2.8 2.8 0 1 1-2.8-2.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M13.8 5c.3 2.1 1.6 3.4 3.7 3.6" fill="none" stroke="#25f4ee" stroke-width="2" stroke-linecap="round"/>' },
    snapchat: { label: "Snapchat", bg: "#fffc00", glyph: '<path d="M12 5c2.3 0 3.6 1.7 3.6 3.8v1.6c.4.3 1 .3 1.6.4-.2.8-1 1-1.6 1.2.3 1 1.2 1.7 2.2 2-.4.8-1.4.9-2.2 1-.2.5-.5.7-1 .7-.7 0-1.3.8-2.6.8s-1.9-.8-2.6-.8c-.5 0-.8-.2-1-.7-.8-.1-1.8-.2-2.2-1 1-.3 1.9-1 2.2-2-.6-.2-1.4-.4-1.6-1.2.6-.1 1.2-.1 1.6-.4V8.8C8.4 6.7 9.7 5 12 5z" fill="#fff" stroke="#111" stroke-width=".9" stroke-linejoin="round"/>' },
    x: { label: "X", bg: "#000", glyph: '<path d="M6.5 5.5l11 13M17.5 5.5l-11 13" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' },
    youtube: { label: "YouTube", bg: "#ff0000", glyph: '<path d="M10 8.8v6.4l5.4-3.2z" fill="#fff"/>' },
    whatsapp: { label: "WhatsApp", bg: "#25d366", glyph: '<path d="M12 5.4a6.6 6.6 0 0 0-5.7 9.9l-.9 3.3 3.4-.9A6.6 6.6 0 1 0 12 5.4z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.7 9.5c.3 2 2 3.7 4.1 4.5l1-1.1-1.6-.8-.7.6a4 4 0 0 1-1.9-1.9l.6-.7-.8-1.6z" fill="#fff"/>' },
    maps: { label: "Google Maps", bg: "#ea4335", glyph: '<path d="M12 19s5-4.6 5-8.8a5 5 0 0 0-10 0C7 14.400 12 19 12 19z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.200" r="1.800" fill="#fff"/>' },
    website: { label: "Site web", bg: "#4b5563", glyph: '<circle cx="12" cy="12" r="6.500" fill="none" stroke="#fff" stroke-width="1.700"/><path d="M5.500 12h13M12 5.500c-2.500 2.700-2.500 10.300 0 13M12 5.500c2.500 2.700 2.500 10.300 0 13" fill="none" stroke="#fff" stroke-width="1.500"/>' },
    other: { label: "Autre lien", bg: "#4b5563", glyph: '<path d="M10.200 13.800a3.300 3.300 0 0 0 4.700 0l2.200-2.200a3.300 3.300 0 0 0-4.700-4.700l-.8.800M13.800 10.200a3.300 3.300 0 0 0-4.700 0l-2.200 2.200a3.300 3.300 0 0 0 4.700 4.700l.8-.8" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round"/>' }
  };
  var iconSeq = 0;
  function iconSvg(platform) {
    var p = PLATFORMS[platform] || PLATFORMS.other;
    var fill = p.bg, defs = "";
    if (p.grad) {
      var id = "ig" + (iconSeq++);
      defs = '<defs><linearGradient id="' + id + '" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="' + p.grad[0] + '"/><stop offset=".5" stop-color="' + p.grad[1] + '"/><stop offset="1" stop-color="' + p.grad[2] + '"/></linearGradient></defs>';
      fill = "url(#" + id + ")";
    }
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + defs + '<rect width="24" height="24" rx="7" fill="' + fill + '"/>' + p.glyph + "</svg>";
  }

  // Version statique (GitHub Pages) : le menu vient de menu.json, pas de l'API, et l'administration est absente.
  var STATIC = !!window.DS_STATIC;
  var state = { products: [], settings: {}, adminOpen: false };

  // ---------------- rendu ----------------
  function renderTicker(settings) {
    var slot = document.getElementById("ticker-slot");
    var b = (settings && settings.banner) || {};
    var text = String(b.text || "").trim();
    if (!b.enabled || !text) { slot.innerHTML = ""; slot.dataset.sig = ""; return; }
    if (slot.dataset.sig === text) return; // évite de relancer l'animation pour rien
    slot.dataset.sig = text;
    var group = "", i;
    for (i = 0; i < 4; i++) group += "<span>" + esc(text) + "</span>";
    slot.innerHTML = '<div class="ticker enter" role="status" aria-label="' + esc(text) + '"><div class="ticker-inner" aria-hidden="true">' + group + group + "</div></div>";
  }

  function stagger(i) { return ' style="--d:' + Math.min(i, 8) * 0.07 + 's"'; }
  function thumbHtml(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">';
    return '<div class="placeholder"><img src="assets/logo.jpg" alt=""><span>Photo bientôt disponible</span></div>';
  }
  function featureCardHtml(p, i, badge) {
    var tag = badge === "moment" ? '<span class="num moment-tag">✦ Du moment</span>'
      : badge ? '<span class="num">' + (i < 9 ? "0" : "") + (i + 1) + "</span>" : "";
    return (
      '<article class="fcard reveal' + (badge === "moment" ? " fcard-moment" : "") + '"' + stagger(i) + ">" + tag +
      '<div class="thumb">' + thumbHtml(p) + "</div>" +
      '<div class="body"><h3 class="name">' + esc(p.name) + "</h3>" +
      (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") +
      (p.note ? '<p class="note">' + esc(p.note) + "</p>" : "") +
      '<span class="price">' + fmtPrice(p.price) + "</span></div></article>"
    );
  }
  function cardHtml(p, i) {
    return (
      '<article class="pcard reveal"' + stagger(i) + ">" +
      (p.image ? '<div class="thumb">' + thumbHtml(p) + "</div>" : "") +
      '<div class="name-row"><h3 class="name" style="font-family:inherit;font-size:1.05rem">' + esc(p.name) + '</h3><span class="price">' + fmtPrice(p.price) + "</span></div>" +
      (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") +
      (p.note ? '<p class="note">' + esc(p.note) + "</p>" : "") +
      "</article>"
    );
  }
  function listHtml(p, i) {
    return (
      '<div class="litem reveal"' + stagger(i) + '><div class="litem-row"><span class="name">' + esc(p.name) + '</span><span class="dots"></span><span class="price">' + fmtPrice(p.price) + "</span></div>" +
      (p.desc ? '<p class="desc">' + esc(p.desc) + "</p>" : "") +
      (p.note ? '<p class="note">' + esc(p.note) + "</p>" : "") + "</div>"
    );
  }
  function byCategory(cat) {
    return state.products.filter(function (p) { return p.category === cat && p.active !== false; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name); });
  }

  function renderProducts() {
    document.querySelectorAll("main [data-cat]").forEach(function (el) {
      var cat = el.getAttribute("data-cat");
      var items = byCategory(cat);
      if (cat === "moment") return;
      if (!items.length) { el.innerHTML = '<p class="empty-note">Rien dans cette catégorie pour le moment.</p>'; return; }
      var fn = el.classList.contains("grid-feature") ? function (p, i) { return featureCardHtml(p, i, cat === "signature" ? "num" : null); }
        : el.classList.contains("list-products") ? listHtml : cardHtml;
      el.innerHTML = items.map(fn).join("");
    });

    // Burgers du moment : totalement absents s'il n'y en a aucun d'actif.
    var moment = byCategory("moment");
    var sect = document.getElementById("moment");
    if (!moment.length) {
      sect.hidden = true;
      sect.querySelector("[data-cat]").innerHTML = "";
    } else {
      var copy = momentCopy(moment.length);
      document.getElementById("moment-eyebrow").textContent = copy.eyebrow;
      document.getElementById("moment-title").textContent = copy.title;
      sect.querySelector("[data-cat]").innerHTML = moment.map(function (p, i) { return featureCardHtml(p, i, "moment"); }).join("");
      sect.hidden = false;
    }

    var nSig = byCategory("signature").length;
    document.getElementById("signature-title").textContent = nSig > 1 ? "Nos " + nSig + " burgers signature" : "Notre burger signature";

    var note = ((state.settings.notes || {}).signature || "").trim();
    var noteEl = document.getElementById("signature-note");
    noteEl.hidden = !note;
    noteEl.textContent = note;
    observeReveals();
  }

  function socialHtml(list, withLabel) {
    return list.map(function (s) {
      var label = s.label || (PLATFORMS[s.platform] || PLATFORMS.other).label;
      return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(label) + (withLabel ? "" : "") + '">' + iconSvg(s.platform) + "<span>" + esc(label) + "</span></a>";
    }).join("");
  }
  // ---------------- diaporama du hero : défile entre les burgers signature ----------------
  var slideTimer = null, slideIdx = 0, slideSig = "";
  var SLIDE_MS = 5000; // une photo toutes les 5 s : tour complet des 3 burgers en 15 s, en boucle
  function renderHeroSlides() {
    var items = byCategory("signature").concat(byCategory("moment")).filter(function (p) { return p.image; });
    var wrap = document.getElementById("hero-slides");
    var cap = document.getElementById("hero-cap");
    var dots = document.getElementById("hero-dots");
    var sig = items.map(function (p) { return p.id + p.image + p.category; }).join("|");
    if (sig === slideSig) return;
    slideSig = sig;
    clearInterval(slideTimer);
    if (items.length < 2) { // une seule photo (ou aucune) : on garde l'image fixe
      cap.hidden = true; dots.hidden = true;
      if (items.length === 1) wrap.innerHTML = '<img class="slide on" src="' + esc(items[0].image) + '" alt="' + esc(items[0].name) + '" width="1100" height="1100">';
      return;
    }
    wrap.innerHTML = items.map(function (p, i) {
      return '<img class="slide' + (i === 0 ? " on" : "") + '" src="' + esc(p.image) + '" alt="' + esc(p.name) + '" width="1100" height="1100"' + (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ">";
    }).join("");
    dots.innerHTML = items.map(function (p, i) {
      return '<button type="button" aria-label="Voir ' + esc(p.name) + '"' + (i === 0 ? ' aria-current="true"' : "") + ' data-i="' + i + '"></button>';
    }).join("");
    cap.hidden = false; dots.hidden = false;
    slideIdx = 0;
    function show(i) {
      slideIdx = (i + items.length) % items.length;
      wrap.querySelectorAll(".slide").forEach(function (s, k) { s.classList.toggle("on", k === slideIdx); });
      dots.querySelectorAll("button").forEach(function (d, k) { if (k === slideIdx) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      var p = items[slideIdx];
      cap.querySelector(".cap-tag").hidden = p.category !== "moment";
      cap.querySelector(".cap-name").textContent = p.name;
      cap.querySelector(".cap-price").textContent = fmtPrice(p.price);
      cap.classList.remove("swap"); void cap.offsetWidth; cap.classList.add("swap");
    }
    function start() {
      clearInterval(slideTimer);
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) slideTimer = setInterval(function () { show(slideIdx + 1); }, SLIDE_MS);
    }
    dots.onclick = function (e) { var b = e.target.closest("button"); if (b) { show(Number(b.dataset.i)); start(); } };
    show(0); start();
  }
  // ---------------- horaires : tous les jours, le jour courant en orange ----------------
  var DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  function todayIndex() { // 0 = lundi, calculé à l'heure de Paris (le snack est à Montmerle-sur-Saône)
    var w = "Mon";
    try { w = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Paris" }).format(new Date()); } catch (e) { var g = new Date().getDay(); return (g + 6) % 7; }
    return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(w);
  }
  function fmtTime(t) { return String(t).replace(":", "h"); }
  function renderHours(hours) {
    var el = document.getElementById("info-hours");
    var note = document.getElementById("hours-note");
    var days = hours && hours.days;
    if (!days || days.length !== 7) { el.innerHTML = "<li>À confirmer</li>"; note.textContent = ""; return; }
    var today = todayIndex();
    el.innerHTML = days.map(function (d, i) {
      var isToday = i === today;
      return '<li' + (isToday ? ' class="today" aria-current="date"' : "") + "><span>" + DAYS[i] + (isToday ? ' <em>aujourd’hui</em>' : "") + "</span><span>" +
        (d.closed ? "Fermé" : fmtTime(d.open) + " – " + fmtTime(d.close)) + "</span></li>";
    }).join("");
    note.textContent = hours.note ? "* " + hours.note : "";
    note.hidden = !hours.note;
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) renderHours((state.settings || {}).hours); });

  function renderInfos() {
    var s = state.settings || {};
    var info = s.info || {};
    var socials = s.socials || [];
    renderHours(s.hours);
    document.getElementById("info-address").textContent = info.address || "À confirmer";
    document.getElementById("foot-address").textContent = [String(info.address || "").replace(/\s*\n\s*/g, ", "), info.phone].filter(Boolean).join(" · ");
    var phoneEl = document.getElementById("info-phone");
    var digits = String(info.phone || "").replace(/[^\d+]/g, "");
    phoneEl.textContent = info.phone || "À confirmer";
    if (digits) { phoneEl.href = "tel:" + digits; phoneEl.removeAttribute("aria-disabled"); } else { phoneEl.removeAttribute("href"); }

    document.getElementById("social-main").innerHTML = socialHtml(socials, true) || '<p class="empty-note">Liens à venir.</p>';
    document.getElementById("social-foot").innerHTML = socialHtml(socials, false);

    var uber = socials.filter(function (x) { return x.platform === "ubereats"; })[0];
    var cta = document.getElementById("hero-cta");
    cta.innerHTML =
      (digits ? '<a class="btn ghost" href="tel:' + esc(digits) + '" aria-label="Appeler le ' + esc(info.phone) + '">Appeler ' + esc(info.phone) + "</a>" : "") +
      (uber ? '<a class="btn" href="' + esc(uber.url) + '" target="_blank" rel="noopener noreferrer">Commander sur Uber Eats</a>' : "") +
      '<a class="btn ghost" href="#signature">Voir le menu</a>';
    var top = document.getElementById("cta-uber-top");
    if (uber) { top.href = uber.url; top.target = "_blank"; top.rel = "noopener noreferrer"; top.textContent = "Commander"; top.hidden = false; } else { top.hidden = true; }
  }

  // ---------------- navigation catégories + scroll-spy ----------------
  var spy = null;
  function renderCatNav() {
    var inner = document.getElementById("catnav-inner");
    var known = inner.dataset.sig || "";
    var secs = Array.prototype.filter.call(document.querySelectorAll("main section[data-nav]"), function (s) { return !s.hidden; });
    var sig = secs.map(function (s) { return s.id; }).join(",");
    if (sig === known) return;
    inner.dataset.sig = sig;
    inner.innerHTML = secs.map(function (s) {
      var isMoment = s.id === "moment";
      return '<a class="chip' + (isMoment ? " moment-chip enter" : "") + '" href="#' + s.id + '" data-target="' + s.id + '">' + esc(isMoment ? momentCopy(byCategory("moment").length).chip : s.getAttribute("data-nav")) + "</a>";
    }).join("");
    if (spy) spy.disconnect();
    if (!("IntersectionObserver" in window)) return;
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        inner.querySelectorAll(".chip").forEach(function (c) {
          var on = c.dataset.target === en.target.id;
          c.classList.toggle("active", on);
          if (on) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
          if (on) { var nav = document.getElementById("catnav"); nav.scrollTo({ left: c.offsetLeft - 24, behavior: "smooth" }); }
        });
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    secs.forEach(function (s) { spy.observe(s); });
  }
  window.addEventListener("scroll", function () {
    document.getElementById("top").classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  // ---------------- apparition au scroll ----------------
  var revealObs = null;
  function observeReveals() {
    var els = document.querySelectorAll(".reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    if (!revealObs) {
      revealObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); revealObs.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    els.forEach(function (e) { revealObs.observe(e); });
  }

  // ---------------- curseur burger ----------------
  var CURSOR_PX = { s: 28, m: 40, l: 56 };
  function cursorSvg(style) {
    var sesame = '<ellipse cx="14" cy="11" rx="1.6" ry=".9" fill="#fff3d6"/><ellipse cx="21" cy="9" rx="1.6" ry=".9" fill="#fff3d6" transform="rotate(20 21 9)"/><ellipse cx="27" cy="12" rx="1.6" ry=".9" fill="#fff3d6" transform="rotate(-20 27 12)"/><ellipse cx="19" cy="13.500" rx="1.600" ry=".9" fill="#fff3d6"/>';
    var inner;
    if (style === "bite") {
      inner = '<defs><mask id="bm"><rect width="40" height="40" fill="#fff"/><circle cx="35" cy="13" r="4.500"/><circle cx="31.500" cy="8.500" r="3.800"/><circle cx="36" cy="22" r="3.500"/></mask></defs>' +
        '<g mask="url(#bm)"><path d="M5 17C5 9 11.500 5 20 5s15 4 15 12z" fill="#e8a33d"/>' + sesame +
        '<path d="M5 18.500q3.700 3 7.500 0t7.500 0 7.500 0 7.500 0v2H5z" fill="#6fae3e"/><rect x="6" y="21" width="28" height="6" rx="3" fill="#5a2f17"/><path d="M6 20.500h28l-4 4.500-4-4.500z" fill="#ffc933"/><rect x="5.500" y="28.500" width="29" height="5.500" rx="3" fill="#d98f2b"/></g>';
    } else if (style === "smash") {
      inner = '<g fill="none" stroke="#fff" stroke-width="1.600" stroke-linecap="round" opacity=".75"><path class="steam" d="M13 7c-2-2 2-3 0-5"/><path class="steam" d="M21 7c-2-2 2-3 0-5"/><path class="steam" d="M29 7c-2-2 2-3 0-5"/></g>' +
        '<path d="M3 20C3 13 10 10 20 10s17 3 17 10z" fill="#e8a33d"/>' + sesame.replace(/cy="(\d+(\.\d+)?)"/g, function (m, v) { return 'cy="' + (Number(v) + 5) + '"'; }) +
        '<path d="M2 21.500h36l-1 1.500h-34z" fill="#ffc933"/><path d="M5 23h30l2 6-2 .5h-30l-2-.5z" fill="#4a2411"/><path d="M5 29.500l2 3.500 2-3.500 2.500 3 2-3zM28 29.500l2 4 2-4" fill="#ffc933"/><rect x="3" y="31" width="34" height="5" rx="2.500" fill="#d98f2b"/>';
    } else {
      inner = '<path d="M5 17C5 9 11.500 5 20 5s15 4 15 12z" fill="#e8a33d"/>' + sesame +
        '<path d="M5 18.500q3.700 3 7.500 0t7.500 0 7.500 0 7.500 0v2H5z" fill="#6fae3e"/><rect x="6" y="21" width="28" height="6" rx="3" fill="#5a2f17"/><path d="M6 20.500h28l-4 4.500-4-4.500z" fill="#ffc933"/><rect x="5.500" y="28.500" width="29" height="5.500" rx="3" fill="#d98f2b"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' + inner + "</svg>";
  }
  var cursorEl = document.getElementById("cursor");
  var cursorOn = false, cursorKey = "";
  function canUseCursor() {
    try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) { return false; }
  }
  function applyCursor(settings) {
    var c = (settings && settings.cursor) || {};
    var on = !!c.enabled && canUseCursor();
    var html = document.documentElement;
    cursorOn = on;
    html.classList.toggle("ds-cursor-on", on);
    if (!on) { cursorEl.classList.remove("show"); cursorEl.innerHTML = ""; cursorKey = ""; return; }
    var key = (c.style || "classic") + "|" + (c.size || "m");
    if (key !== cursorKey) {
      cursorKey = key;
      cursorEl.innerHTML = cursorSvg(c.style || "classic");
      cursorEl.style.setProperty("--cs", (CURSOR_PX[c.size] || 40) + "px");
    }
  }
  var HOVERABLE = "a,button,.chip,label,[role=tab],.fcard,.pcard,.litem";
  window.addEventListener("mousemove", function (e) {
    if (!cursorOn) return;
    var t = e.target;
    var native = t.closest && t.closest("input,textarea,select,#admin");
    cursorEl.classList.toggle("show", !native);
    if (native) return;
    cursorEl.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)";
    cursorEl.classList.toggle("hover", !!(t.closest && t.closest(HOVERABLE)));
  }, { passive: true });
  window.addEventListener("mousedown", function () { cursorEl.classList.add("down"); });
  window.addEventListener("mouseup", function () { cursorEl.classList.remove("down"); });
  document.documentElement.addEventListener("mouseleave", function () { cursorEl.classList.remove("show"); });

  // ---------------- fond animé (thème burger) ----------------
  function buildFx() {
    var fx = document.getElementById("fx");
    if (!fx) return;
    var S = 'viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
    var ICONS = [
      '<svg ' + S + '><ellipse cx="24" cy="24" rx="6" ry="11" transform="rotate(35 24 24)" fill="currentColor"/></svg>', // graine de sésame
      '<svg ' + S + '><path d="M8 26c0-9 7-15 16-15s16 6 16 15z"/><path d="M6 31q4 3 9 0t9 0 9 0 9 0"/><rect x="8" y="36" width="32" height="6" rx="3"/></svg>', // burger
      '<svg ' + S + '><path d="M10 20h28l-3 22H13z"/><path d="M17 20l-2-12M24 20V6M31 20l2-12"/></svg>', // frites
      '<svg ' + S + '><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="7"/></svg>', // onion ring
      '<svg ' + S + '><path d="M6 36L42 36 24 8z"/><circle cx="22" cy="28" r="2"/><circle cx="30" cy="31" r="1.5"/></svg>' // fromage
    ];
    var n = window.innerWidth < 700 ? 9 : 18, html = '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>', i;
    for (i = 0; i < n; i++) {
      var t = 34 + Math.random() * 30, size = 26 + Math.random() * 40;
      html += '<span class="it" style="left:' + (Math.random() * 96).toFixed(1) + "%;--t:" + t.toFixed(1) + "s;--d:-" + (Math.random() * t).toFixed(1) +
        "s;--s:" + size.toFixed(0) + "px;--o:" + (0.07 + Math.random() * 0.1).toFixed(2) + ";--sp:" + (10 + Math.random() * 16).toFixed(0) + 's">' + ICONS[i % ICONS.length] + "</span>";
    }
    fx.innerHTML = html;
  }

  // ---------------- chargement des données ----------------
  function renderAll() {
    renderTicker(state.settings);
    renderProducts();
    renderHeroSlides();
    renderInfos();
    renderCatNav();
    applyCursor(state.settings);
  }
  async function loadMenu() {
    try {
      var res = await fetch(STATIC ? "menu.json" : "/api/menu", { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      var data = await res.json();
      state.products = data.products || [];
      if (STATIC) state.products.forEach(function (p) { if (p.image) p.image = String(p.image).replace(/^\//, ""); }); // chemins relatifs (site servi dans un sous-dossier)
      state.settings = data.settings || {};
      renderAll();
      observeReveals();
      document.dispatchEvent(new CustomEvent("ds:menu-updated"));
    } catch (e) {
      console.error("menu load failed", e);
      document.querySelectorAll("main [data-cat]").forEach(function (el) {
        if (!el.children.length) el.innerHTML = '<p class="empty-note">Le menu n’a pas pu être chargé. Rechargez la page dans un instant.</p>';
      });
    }
  }

  // ---------------- raccourci d'ouverture de l'admin (Maj + I + B) ----------------
  // Simple confort d'interface : il charge seulement le module admin. L'accès réel est contrôlé par le serveur.
  var pressed = new Set();
  var adminLoading = null;
  function loadAdmin() {
    if (window.DSAdmin) return Promise.resolve();
    if (adminLoading) return adminLoading;
    adminLoading = new Promise(function (resolve, reject) {
      var css = document.createElement("link");
      css.rel = "stylesheet"; css.href = "/css/admin.css";
      document.head.appendChild(css);
      var js = document.createElement("script");
      js.src = "/js/admin.js";
      js.onload = resolve;
      js.onerror = function () { adminLoading = null; reject(new Error("admin load failed")); };
      document.body.appendChild(js);
    });
    return adminLoading;
  }
  function openAdmin() {
    if (STATIC) { toast("L’administration n’est pas disponible sur la version en ligne.", "err"); return; }
    loadAdmin().then(function () { window.DSAdmin.open(); })
      .catch(function () { toast("Impossible de charger l’administration.", "err"); });
  }
  window.addEventListener("keydown", function (e) {
    if (isTypingTarget(e.target) || !e.key) return;
    pressed.add(e.key.toLowerCase());
    if (e.shiftKey && pressed.has("i") && pressed.has("b") && !e.repeat) openAdmin();
  });
  window.addEventListener("keyup", function (e) { if (e.key) pressed.delete(e.key.toLowerCase()); });
  window.addEventListener("blur", function () { pressed.clear(); });

  window.DS = {
    state: state, esc: esc, fmtPrice: fmtPrice, toast: toast, iconSvg: iconSvg, PLATFORMS: PLATFORMS,
    momentCopy: momentCopy, cursorSvg: cursorSvg, reload: loadMenu
  };

  buildFx();
  observeReveals();
  loadMenu();
})();
