(function () {
  "use strict";
  var DS = window.DS;
  var esc = DS.esc, fmtPrice = DS.fmtPrice, toast = DS.toast;
  var TOKEN_KEY = "ds_admin_auth";

  var ERRORS = {
    unauthorized: "Identifiants refusés.",
    too_many_attempts: "Trop de tentatives. Réessayez dans quelques minutes.",
    admin_disabled: "L’administration est désactivée : aucun mot de passe n’est défini dans le fichier .env du serveur.",
    name_required: "Le nom est obligatoire.",
    invalid_price: "Le prix est invalide.",
    invalid_image: "Image invalide.",
    invalid_hours: "Horaires invalides : l’heure de fermeture doit être après l’ouverture.",
    invalid_url: "Un des liens est invalide (il doit commencer par https://).",
    invalid_category: "Catégorie invalide.",
    signature_fixed: "Les 3 burgers de base ne peuvent pas être supprimés.",
    signature_always_active: "Les 3 burgers de base restent toujours visibles.",
    unsupported_type: "Format d’image non accepté (JPG, PNG, WebP ou GIF).",
    upload_failed: "L’envoi de l’image a échoué (10 Mo maximum).",
    not_found: "Élément introuvable (déjà supprimé ?)."
  };
  function errMsg(e) { if (e && e.custom) return e.custom; return ERRORS[e && e.code] || ("Erreur (" + ((e && (e.code || e.message)) || "inconnue") + ")"); }

  var CAT_LABELS = { snacking: "Snacking", kids: "Menu enfant", frites: "Frites", supplements: "Suppléments", desserts: "Desserts" };

  // ---------------- authentification ----------------
  // Le jeton vit en mémoire (toujours disponible) et est recopié dans sessionStorage si possible.
  // Il n'est effacé que par une vraie réponse 401 du serveur ou par « Se déconnecter » — jamais par une erreur d'affichage.
  var token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) {}
  function setToken(user, pass) {
    var bytes = new TextEncoder().encode(user + ":" + pass), bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    token = "Basic " + btoa(bin);
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  }
  function clearToken() {
    token = null;
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  async function api(method, url, body, form) {
    var headers = {};
    if (token) headers.Authorization = token;
    var init = { method: method, headers: headers };
    if (form) init.body = form;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    var res = await fetch(url, init);
    if (res.status === 401) { clearToken(); showLogin("Session expirée ou identifiants refusés. Reconnectez-vous."); throw { code: "unauthorized", handled: true }; }
    if (!res.ok) { var b = await res.json().catch(function () { return {}; }); throw { code: b.error || res.status }; }
    return res.status === 204 ? null : res.json();
  }

  // ---------------- squelette ----------------
  function fieldsProduct(p, withImage) {
    p = p || {};
    return (
      '<div class="a-row">' +
      '<label>Nom<input name="name" type="text" maxlength="120" required value="' + esc(p.name || "") + '"></label>' +
      '<label>Prix (€)<input name="price" type="number" step="0.10" min="0" required inputmode="decimal" value="' + (p.price != null ? p.price : "") + '"></label></div>' +
      '<label>Description<textarea name="desc" maxlength="400" rows="2">' + esc(p.desc || "") + "</textarea></label>" +
      '<label>Note (optionnel)<input name="note" type="text" maxlength="400" value="' + esc(p.note || "") + '"></label>' +
      (withImage ? imageField(p) : "")
    );
  }
  function imageField(p) {
    return (
      '<div class="a-image"><label>Photo (JPG, PNG ou WebP — idéalement 1200 px ou plus de large)<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>' +
      '<div class="a-preview" aria-live="polite">' + (p.image ? '<img src="' + esc(p.image) + '" alt="Photo actuelle">' : "") + "</div>" +
      (p.image ? '<label class="a-check"><input type="checkbox" name="removeImage"> Retirer la photo actuelle</label>' : "") + "</div>"
    );
  }
  function addForm(cat, title, withCat) {
    var catSel = withCat ? '<label>Catégorie du produit<select name="category">' +
      Object.keys(CAT_LABELS).map(function (k) { return '<option value="' + k + '">' + CAT_LABELS[k] + "</option>"; }).join("") + "</select></label>" : "";
    return '<form class="a-card a-add" data-form="add" data-cat="' + cat + '" novalidate><h3>' + title + "</h3>" + catSel + fieldsProduct(null, true) +
      '<p class="a-err" role="alert"></p><button class="btn sm" type="submit">Ajouter</button></form>';
  }
  var PLATFORM_OPTIONS = Object.keys(DS.PLATFORMS).map(function (k) { return '<option value="' + k + '">' + DS.PLATFORMS[k].label + "</option>"; }).join("");

  var SKELETON =
    '<div class="a-shell">' +
    '<header class="a-head"><div><h2>Administration</h2><p class="a-sub">Daily Smash</p></div>' +
    '<div class="a-head-actions"><button class="btn ghost sm" type="button" data-act="logout" id="a-logout" hidden>Se déconnecter</button>' +
    '<button class="btn sm" type="button" data-act="close">Voir le site</button></div></header>' +

    '<section id="a-login" class="a-card a-login" hidden>' +
    '<h3>Connexion équipe</h3><p class="a-help">Le raccourci Maj + I + B ouvre seulement cette fenêtre : l’accès est vérifié par le serveur avec les identifiants du fichier <code>.env</code>.</p>' +
    '<form id="a-login-form" novalidate><label>Identifiant<input name="user" type="text" autocomplete="username" required></label>' +
    '<label>Mot de passe<input name="pass" type="password" autocomplete="current-password" required></label>' +
    '<p class="a-err" id="a-login-err" role="alert"></p><button class="btn" type="submit">Se connecter</button></form></section>' +

    '<div id="a-main" hidden>' +
    '<div class="a-tabs" role="tablist" aria-label="Sections">' +
    ['signature|Burgers signature', 'moment|Burgers du moment', 'menu|Autres produits', 'bandeau|Bandeau', 'curseur|Curseur', 'infos|Infos & réseaux'].map(function (t, i) {
      var x = t.split("|"); return '<button role="tab" type="button" class="a-tab" data-tab="' + x[0] + '" aria-selected="' + (i === 0) + '">' + x[1] + "</button>";
    }).join("") + "</div>" +

    '<section class="a-panel" data-panel="signature"><p class="a-help">Les 3 burgers « de base » (Classico, Smoky, Sweety) sont toujours affichés : vous pouvez modifier leur prix, leur description et leur photo, mais pas les supprimer ni les masquer. Les burgers signature que vous ajoutez ci-dessous peuvent être masqués ou supprimés, et rejoignent le diaporama de l’accueil dès qu’ils ont une photo.</p><div id="a-list-signature" class="a-list"></div>' + addForm("signature", "Ajouter un burger signature") + '</section>' +

    '<section class="a-panel" data-panel="moment" hidden><p class="a-help" id="a-moment-help"></p><div id="a-list-moment" class="a-list"></div>' + addForm("moment", "Ajouter un burger du moment") + "</section>" +

    '<section class="a-panel" data-panel="menu" hidden><label class="a-cat">Afficher<select id="a-cat"><option value="all">Tout</option>' +
    Object.keys(CAT_LABELS).map(function (k) { return '<option value="' + k + '">' + CAT_LABELS[k] + "</option>"; }).join("") +
    '</select></label><div id="a-list-menu" class="a-list"></div>' + addForm("", "Ajouter un produit", true) + "</section>" +

    '<section class="a-panel" data-panel="bandeau" hidden><form class="a-card" data-form="banner" novalidate><h3>Bandeau défilant</h3>' +
    '<p class="a-help">Un message qui défile en haut du site : annonce, fermeture exceptionnelle, célébration…</p>' +
    '<label class="a-check"><input type="checkbox" name="enabled"> Afficher le bandeau sur le site</label>' +
    '<label>Message<input name="text" type="text" maxlength="200" placeholder="Ex. Fermé exceptionnellement le 25 décembre"></label>' +
    '<div class="a-banner-prev" id="a-banner-prev" aria-hidden="true"></div><p class="a-err" role="alert"></p><button class="btn sm" type="submit">Enregistrer</button></form></section>' +

    '<section class="a-panel" data-panel="curseur" hidden><form class="a-card" data-form="cursor" novalidate><h3>Curseur burger</h3>' +
    '<p class="a-help">Remplace le curseur de la souris sur ordinateur. Jamais affiché sur téléphone ou tablette.</p>' +
    '<label class="a-check"><input type="checkbox" name="enabled"> Activer le curseur burger</label>' +
    '<fieldset><legend>Apparence</legend><div class="a-choices" id="a-cursor-styles"></div></fieldset>' +
    '<fieldset><legend>Taille</legend><div class="a-choices" id="a-cursor-sizes"></div></fieldset>' +
    '<p class="a-err" role="alert"></p><button class="btn sm" type="submit">Enregistrer</button></form></section>' +

    '<section class="a-panel" data-panel="infos" hidden><form class="a-card" data-form="infos" novalidate><h3>Informations pratiques</h3>' +
    '<label>Adresse (retour à la ligne : n° et rue, puis code postal et ville)<textarea name="address" rows="2" maxlength="200"></textarea></label>' +
    '<label>Téléphone<input name="phone" type="tel" maxlength="40"></label>' +
    '<h3 class="a-sub-h">Horaires d’ouverture</h3><p class="a-help">Le jour de la consultation est mis en orange sur le site.</p>' +
    '<div id="a-hours"></div><label>Message sous les horaires (affiché avec un astérisque)<input name="hoursNote" type="text" maxlength="200"></label>' +
    '<h3 class="a-sub-h">Réseaux sociaux et liens</h3><p class="a-help">Chaque lien s’affiche sur le site avec le logo de la plateforme choisie.</p>' +
    '<div id="a-socials"></div><button class="btn ghost sm" type="button" data-act="add-social">+ Ajouter un réseau</button>' +
    '<p class="a-err" role="alert"></p><div><button class="btn sm" type="submit">Enregistrer</button></div></form></section>' +
    "</div></div>" +

    '<div class="a-confirm" id="a-confirm" hidden role="alertdialog" aria-modal="true" aria-labelledby="a-confirm-msg"><div class="a-confirm-box"><p id="a-confirm-msg"></p>' +
    '<div><button class="btn ghost sm" type="button" data-act="confirm-no">Annuler</button> <button class="btn danger sm" type="button" data-act="confirm-yes">Supprimer</button></div></div></div>';

  var root = document.createElement("div");
  root.id = "admin";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Administration Daily Smash");
  root.hidden = true;
  root.innerHTML = SKELETON;
  document.body.appendChild(root);

  var lastFocus = null;
  var $ = function (sel) { return root.querySelector(sel); };

  // ---------------- ouverture / fermeture ----------------
  function open() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("admin-open");
    requestAnimationFrame(function () { root.classList.add("in"); });
    if (token) checkAuth(); else showLogin("");
  }
  function close() {
    root.classList.remove("in");
    document.documentElement.classList.remove("admin-open");
    setTimeout(function () { root.hidden = true; }, 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function showLogin(msg) {
    $("#a-login").hidden = false; $("#a-main").hidden = true; $("#a-logout").hidden = true;
    $("#a-login-err").textContent = msg || "";
    var pass = $('#a-login-form [name="pass"]'); if (pass) { pass.value = ""; setTimeout(function () { pass.focus(); }, 60); }
  }
  async function checkAuth() {
    try { await api("GET", "/api/admin/ping"); }
    catch (e) { if (!e.handled) showLogin(errMsg(e)); return; }
    showMain();
  }
  function showMain() {
    $("#a-login").hidden = true; $("#a-main").hidden = false; $("#a-logout").hidden = false;
    try { renderAll(); } catch (e) { console.error(e); toast("Erreur d’affichage de l’administration (voir la console).", "err"); }
  }

  // ---------------- listes de produits ----------------
  function itemHtml(p, showCat) {
    var fixed = !!p.core;
    return (
      '<div class="a-item' + (p.active ? "" : " off") + '" data-id="' + esc(p.id) + '">' +
      '<div class="a-item-top"><div class="a-thumb">' + (p.image ? '<img src="' + esc(p.image) + '" alt="">' : "<span>Pas de photo</span>") + "</div>" +
      '<div class="a-main"><strong>' + esc(p.name) + '</strong> <span class="a-price">' + fmtPrice(p.price) + "</span>" +
      (showCat ? ' <span class="a-badge cat">' + esc(CAT_LABELS[p.category] || p.category) + "</span>" : "") +
      (fixed ? ' <span class="a-badge base">de base</span>' : "") +
      (p.active ? "" : ' <span class="a-badge">masqué</span>') +
      (p.desc ? '<div class="a-desc">' + esc(p.desc) + "</div>" : "") + "</div></div>" +
      '<div class="a-actions">' +
      (fixed ? "" : '<button type="button" class="btn ghost sm" data-act="toggle">' + (p.active ? "Masquer" : "Afficher") + "</button>") +
      '<button type="button" class="btn ghost sm" data-act="edit">Modifier</button>' +
      (fixed ? "" : '<button type="button" class="btn danger sm" data-act="delete">Supprimer</button>') +
      '</div><div class="a-edit" hidden></div></div>'
    );
  }
  function list(cat) {
    return DS.state.products.filter(function (p) { return p.category === cat; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function renderLists() {
    var sig = list("signature");
    $("#a-list-signature").innerHTML = sig.length ? sig.map(function (p) { return itemHtml(p); }).join("") : '<p class="a-empty">Aucun burger signature trouvé dans data/menu.json.</p>';
    var mo = list("moment");
    $("#a-list-moment").innerHTML = mo.length ? mo.map(function (p) { return itemHtml(p); }).join("") : '<p class="a-empty">Aucun burger du moment. Tant qu’il n’y en a aucun d’actif, la section n’apparaît pas sur le site.</p>';
    var active = mo.filter(function (p) { return p.active; }).length;
    $("#a-moment-help").textContent = active
      ? "Affiché sur le site sous le titre « " + DS.momentCopy(active).title + " » (" + active + " actif" + (active > 1 ? "s" : "") + ")."
      : "Rien d’actif : la section est entièrement masquée sur le site. Ajoutez-en un ci-dessous pour la faire apparaître.";
    var cat = $("#a-cat").value;
    var items = cat === "all"
      ? Object.keys(CAT_LABELS).reduce(function (acc, k) { return acc.concat(list(k)); }, [])
      : list(cat);
    $("#a-list-menu").innerHTML = items.length ? items.map(function (p) { return itemHtml(p, cat === "all"); }).join("") : '<p class="a-empty">Aucun produit dans cette catégorie.</p>';
  }

  // ---------------- réglages ----------------
  function socialRow(s) {
    s = s || { platform: "other", label: "", url: "" };
    return (
      '<div class="a-social-row" data-row><span class="a-ico">' + DS.iconSvg(s.platform) + "</span>" +
      '<label>Plateforme<select name="platform">' + PLATFORM_OPTIONS.replace('value="' + s.platform + '"', 'value="' + s.platform + '" selected') + "</select></label>" +
      '<label>Nom affiché<input name="label" type="text" maxlength="40" value="' + esc(s.label) + '" placeholder="' + esc((DS.PLATFORMS[s.platform] || DS.PLATFORMS.other).label) + '"></label>' +
      '<label class="grow">Lien<input name="url" type="url" inputmode="url" maxlength="400" placeholder="https://…" value="' + esc(s.url) + '"></label>' +
      '<button type="button" class="btn ghost sm" data-act="rm-social" aria-label="Retirer ce réseau">Retirer</button><input type="hidden" name="id" value="' + esc(s.id || "") + '"></div>'
    );
  }
  var CURSOR_STYLES = [["classic", "Classique"], ["bite", "Croqué"], ["smash", "Smash fumant"]];
  var CURSOR_SIZES = [["s", "Petit"], ["m", "Moyen"], ["l", "Grand"]];
  function fillSettings() {
    var s = DS.state.settings || {};
    var b = s.banner || {}, c = s.cursor || {}, i = s.info || {};
    var fb = $('[data-form="banner"]'); fb.enabled.checked = !!b.enabled; fb.text.value = b.text || ""; bannerPreview();
    var fc = $('[data-form="cursor"]'); fc.enabled.checked = !!c.enabled;
    $("#a-cursor-styles").innerHTML = CURSOR_STYLES.map(function (x) {
      return '<label class="a-choice"><input type="radio" name="style" value="' + x[0] + '"' + ((c.style || "classic") === x[0] ? " checked" : "") + '><span class="a-cur">' + DS.cursorSvg(x[0]) + "</span>" + x[1] + "</label>";
    }).join("");
    $("#a-cursor-sizes").innerHTML = CURSOR_SIZES.map(function (x) {
      return '<label class="a-choice"><input type="radio" name="size" value="' + x[0] + '"' + ((c.size || "m") === x[0] ? " checked" : "") + ">" + x[1] + "</label>";
    }).join("");
    var fi = $('[data-form="infos"]'); fi.address.value = i.address || ""; fi.phone.value = i.phone || "";
    var hrs = s.hours || {};
    var DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    $("#a-hours").innerHTML = DAYS.map(function (n, k) {
      var d = (hrs.days || [])[k] || { closed: false, open: "18:00", close: "21:30" };
      return '<div class="a-hours-row" data-day="' + k + '"><strong>' + n + '</strong><label class="a-check"><input type="checkbox" name="closed"' + (d.closed ? " checked" : "") + '> Fermé</label>' +
        '<label>Ouverture<input type="time" name="open" value="' + esc(d.open || "18:00") + '"' + (d.closed ? " disabled" : "") + '></label>' +
        '<label>Fermeture<input type="time" name="close" value="' + esc(d.close || "21:30") + '"' + (d.closed ? " disabled" : "") + "></label></div>";
    }).join("");
    fi.elements.hoursNote.value = hrs.note || "";
    $("#a-socials").innerHTML = (s.socials || []).map(socialRow).join("");
  }
  function bannerPreview() {
    var fb = $('[data-form="banner"]');
    var t = fb.text.value.trim();
    $("#a-banner-prev").textContent = t ? t : "Aperçu du message";
    $("#a-banner-prev").classList.toggle("empty", !t);
  }
  function renderAll() { renderLists(); fillSettings(); updateTabs(); }

  // ---------------- confirmation de suppression ----------------
  function confirmDialog(msg) {
    return new Promise(function (resolve) {
      var box = $("#a-confirm");
      $("#a-confirm-msg").textContent = msg;
      box.hidden = false;
      var yes = box.querySelector('[data-act="confirm-yes"]'), no = box.querySelector('[data-act="confirm-no"]');
      no.focus();
      function done(v) { box.hidden = true; yes.onclick = no.onclick = null; box.onkeydown = null; resolve(v); }
      yes.onclick = function () { done(true); };
      no.onclick = function () { done(false); };
      box.onkeydown = function (e) { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
    });
  }

  // ---------------- actions ----------------
  async function uploadImage(file) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw { code: "unsupported_type" };
    if (file.size > 10 * 1024 * 1024) throw { code: "upload_failed" };
    var fd = new FormData(); fd.append("image", file);
    return (await api("POST", "/api/admin/upload", undefined, fd)).url;
  }
  function setErr(form, msg) { var el = form.querySelector(".a-err"); if (el) el.textContent = msg || ""; }
  async function withBusy(form, fn) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    setErr(form, "");
    try { await fn(); }
    catch (e) { if (!e.handled) { setErr(form, errMsg(e)); toast(errMsg(e), "err"); } }
    finally { if (btn) btn.disabled = false; }
  }
  async function reload() { await DS.reload(); if (!root.hidden && !$("#a-main").hidden) renderLists(); }

  function readProduct(form) {
    var el = form.elements;
    var name = el.name.value.trim();
    var price = parseFloat(String(el.price.value).replace(",", "."));
    if (!name) throw { code: "name_required" };
    if (!isFinite(price) || price < 0) throw { code: "invalid_price" };
    return { name: name, price: price, desc: el.desc.value.trim(), note: el.note.value.trim() };
  }

  root.addEventListener("click", async function (ev) {
    var btn = ev.target.closest("[data-act]");
    if (btn) {
      var act = btn.dataset.act;
      var item = btn.closest(".a-item");
      var id = item && item.dataset.id;
      var p = id && DS.state.products.filter(function (x) { return x.id === id; })[0];
      if (act === "close") close();
      else if (act === "logout") { clearToken(); showLogin("Vous êtes déconnecté."); }
      else if (act === "toggle" && p) {
        try { await api("PATCH", "/api/admin/products/" + encodeURIComponent(id), { active: !p.active }); toast(p.active ? "Produit masqué" : "Produit affiché", "ok"); await reload(); }
        catch (e) { if (!e.handled) toast(errMsg(e), "err"); }
      } else if (act === "delete" && p) {
        if (await confirmDialog("Supprimer définitivement « " + p.name + " » ? Cette action est irréversible.")) {
          try { await api("DELETE", "/api/admin/products/" + encodeURIComponent(id)); toast("Supprimé", "ok"); await reload(); }
          catch (e) { if (!e.handled) toast(errMsg(e), "err"); }
        }
      } else if (act === "edit" && p) {
        var slot = item.querySelector(".a-edit");
        if (!slot.hidden) { slot.hidden = true; slot.innerHTML = ""; return; }
        slot.innerHTML = '<form data-form="edit" novalidate>' + fieldsProduct(p, true) + '<p class="a-err" role="alert"></p><button class="btn sm" type="submit">Enregistrer</button> <button class="btn ghost sm" type="button" data-act="cancel-edit">Annuler</button></form>';
        slot.hidden = false;
        slot.querySelector("input").focus();
      } else if (act === "cancel-edit") {
        var s2 = btn.closest(".a-edit"); s2.hidden = true; s2.innerHTML = "";
      } else if (act === "add-social") {
        $("#a-socials").insertAdjacentHTML("beforeend", socialRow());
        var rows = $("#a-socials").querySelectorAll("[data-row]"); rows[rows.length - 1].querySelector("select").focus();
      } else if (act === "rm-social") { btn.closest("[data-row]").remove(); }
      return;
    }
    var tab = ev.target.closest(".a-tab");
    if (tab) { currentTab = tab.dataset.tab; updateTabs(); }
  });
  var currentTab = "signature";
  function updateTabs() {
    root.querySelectorAll(".a-tab").forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.tab === currentTab)); });
    root.querySelectorAll(".a-panel").forEach(function (pn) { pn.hidden = pn.dataset.panel !== currentTab; });
  }

  root.addEventListener("change", async function (ev) {
    var t = ev.target;
    if (t.id === "a-cat") {
      renderLists();
      var cs = root.querySelector('[data-panel="menu"] [name="category"]');
      if (cs && t.value !== "all") cs.value = t.value; // le formulaire d'ajout suit le filtre
      return;
    }
    if (t.type === "file") {
      var prev = t.closest(".a-image").querySelector(".a-preview"), f = t.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      prev.innerHTML = '<img src="' + url + '" alt="Aperçu">';
      var img = prev.firstChild;
      img.onload = function () {
        if (img.naturalWidth < 800) prev.insertAdjacentHTML("beforeend", '<p class="a-warn">⚠ Image petite (' + img.naturalWidth + " px de large) : elle risque d’être floue. Prévoyez 1200 px ou plus.</p>");
      };
    }
    if (t.name === "closed" && t.closest(".a-hours-row")) {
      t.closest(".a-hours-row").querySelectorAll('input[type="time"]').forEach(function (x) { x.disabled = t.checked; });
    }
    if (t.name === "platform" && t.closest("[data-row]")) {
      var row = t.closest("[data-row]");
      row.querySelector(".a-ico").innerHTML = DS.iconSvg(t.value);
      row.querySelector('[name="label"]').placeholder = (DS.PLATFORMS[t.value] || DS.PLATFORMS.other).label;
    }
  });
  root.addEventListener("input", function (ev) { if (ev.target.form && ev.target.form.dataset.form === "banner") bannerPreview(); });

  root.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var form = ev.target, kind = form.dataset.form;
    if (form.id === "a-login-form") return login(form);
    if (kind === "add") return withBusy(form, async function () {
      var cat = form.dataset.cat || form.elements.category.value;
      var body = readProduct(form); body.category = cat;
      var file = form.elements.image.files[0];
      if (file) body.image = await uploadImage(file);
      await api("POST", "/api/admin/products", body);
      form.reset(); form.querySelector(".a-preview").innerHTML = "";
      toast("Produit ajouté", "ok"); await reload();
    });
    if (kind === "edit") return withBusy(form, async function () {
      var id = form.closest(".a-item").dataset.id;
      var body = readProduct(form);
      var file = form.elements.image.files[0];
      if (file) body.image = await uploadImage(file);
      else if (form.removeImage && form.removeImage.checked) body.image = null;
      await api("PATCH", "/api/admin/products/" + encodeURIComponent(id), body);
      toast("Modifications enregistrées", "ok"); await reload();
    });
    if (kind === "banner") return withBusy(form, async function () {
      var text = form.text.value.trim();
      if (form.enabled.checked && !text) throw { code: "name_required", custom: "Saisissez un message ou désactivez le bandeau." };
      await api("PUT", "/api/admin/settings", { banner: { enabled: form.enabled.checked, text: text } });
      toast("Bandeau enregistré", "ok"); await DS.reload();
    }).then(function () {});
    if (kind === "cursor") return withBusy(form, async function () {
      await api("PUT", "/api/admin/settings", { cursor: { enabled: form.enabled.checked, style: form.elements.style.value, size: form.elements.size.value } });
      toast("Curseur enregistré", "ok"); await DS.reload();
    });
    if (kind === "infos") return withBusy(form, async function () {
      var socials = [];
      root.querySelectorAll("#a-socials [data-row]").forEach(function (row) {
        var url = row.querySelector('[name="url"]').value.trim();
        if (!url) throw { code: "invalid_url" };
        try { var u = new URL(url); if (u.protocol !== "https:" && u.protocol !== "http:") throw 0; } catch (e) { throw { code: "invalid_url" }; }
        socials.push({ id: row.querySelector('[name="id"]').value, platform: row.querySelector('[name="platform"]').value, label: row.querySelector('[name="label"]').value.trim(), url: url });
      });
      var days = [];
      root.querySelectorAll("#a-hours .a-hours-row").forEach(function (row) {
        days.push({ closed: row.querySelector('[name="closed"]').checked, open: row.querySelector('[name="open"]').value, close: row.querySelector('[name="close"]').value });
      });
      await api("PUT", "/api/admin/settings", { info: { address: form.address.value.trim(), phone: form.phone.value.trim() }, hours: { days: days, note: form.elements.hoursNote.value.trim() }, socials: socials });
      toast("Informations enregistrées", "ok"); await DS.reload(); fillSettings();
    });
  });

  async function login(form) {
    var user = form.user.value.trim(), pass = form.pass.value;
    var err = $("#a-login-err");
    if (!user || !pass) { err.textContent = "Saisissez l’identifiant et le mot de passe."; return; }
    setToken(user, pass);
    try { await api("GET", "/api/admin/ping"); }
    catch (e) { if (!e.handled) { clearToken(); err.textContent = errMsg(e); } return; }
    err.textContent = "";
    showMain();
  }

  root.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("#a-confirm").hidden) close(); });
  document.addEventListener("ds:menu-updated", function () { if (!root.hidden && !$("#a-main").hidden) renderLists(); });

  window.DSAdmin = { open: open, close: close };
})();
