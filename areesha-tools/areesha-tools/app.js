/* Areesha Tools — shared app logic: paywall, Pro codes, and tool helpers. */
(function () {
  "use strict";

  // Auto-generated code hashes (SHA-256). Plaintext codes are NEVER stored in site files.
// NOTE: activation codes are verified server-side via POST /api/verify-code.
// No code hashes or secrets are stored in this file. Configure them as
// Vercel Environment Variables (see .env.example).


  var AT_FREE_LIMIT = 3;
  var AT_MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
  var AT_WA_NUMBER = "923214930875";
  var AT_PRO_TOOL_LIMIT = 2; // Pro (Rs. 500/month) = unlimited use of any 2 tools

  /* All tools on the site. id must match the usage-note / tool page id. */
  var AT_TOOLS = [
    { id: "wa-link",     name: "WhatsApp Link Generator",      icon: "\uD83D\uDCAC", page: "whatsapp-link-generator.html", blurb: "Turn any number into a clickable WhatsApp chat link." },
    { id: "seo-check",   name: "Website SEO Checker",          icon: "\uD83D\uDD0D", page: "seo-checker.html",             blurb: "Automatic 0\u2013100 SEO score for any website." },
    { id: "qr-gen",       name: "QR Code Generator",            icon: "\u2B1B",       page: "qr-generator.html",            blurb: "QR codes for links, menus, payments & more." },
    { id: "invoice",     name: "Invoice Generator",            icon: "\uD83E\uDDFE", page: "invoice-generator.html",       blurb: "Professional PKR invoices \u2014 print or save as PDF." },
    { id: "review-link", name: "Google Review Link Generator", icon: "\u2B50",       page: "review-link-generator.html",   blurb: "One-tap review links & QR codes for your business." },
    { id: "ad-headline", name: "Ad Headline Generator",        icon: "\uD83D\uDCE2", page: "ad-headline-generator.html",   blurb: "High-converting ad headlines in English + Roman Urdu." },
    { id: "img-compress",name: "Image Compressor",             icon: "\uD83D\uDDDC", page: "image-compressor.html",        blurb: "Shrink photo size without losing quality." },
    { id: "hashtag",     name: "Hashtag Generator",            icon: "#\uFE0F\u20E3", page: "hashtag-generator.html",      blurb: "Ready-made hashtag sets for every niche." },
    { id: "utm",         name: "UTM Link Builder",             icon: "\uD83D\uDD17", page: "utm-builder.html",             blurb: "Trackable campaign links in seconds." }
  ];
  function toolById(id) {
    for (var i = 0; i < AT_TOOLS.length; i++) if (AT_TOOLS[i].id === id) return AT_TOOLS[i];
    return null;
  }

  /* ---------- storage helpers ---------- */
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (e) { return null; }
  }
  function isAdmin() { return !!readJson("at_admin"); }
  function getPro() {
    var s = readJson("at_pro");
    if (!s) return null;
    if (Date.now() > s.expiresAt) { try { localStorage.removeItem("at_pro"); } catch (e) {} return null; }
    return s;
  }
  /* Tools the current Pro subscription unlocks (admin = everything). */
  function proTools() {
    var p = getPro();
    if (!p || !Array.isArray(p.tools)) return [];
    return p.tools.filter(function (id) { return !!toolById(id); });
  }
  function hasAccess(tool) {
    if (isAdmin()) return true;
    return proTools().indexOf(tool) !== -1;
  }
  /* Pro is active but the visitor hasn't picked their tools yet. */
  function needsToolPick() {
    var p = getPro();
    return !!p && (!Array.isArray(p.tools) || p.tools.length === 0);
  }

  function usesLeft(tool) {
    if (hasAccess(tool)) return Infinity;
    var used = parseInt(localStorage.getItem("at_use_" + tool + "_" + todayKey()) || "0", 10);
    return Math.max(0, AT_FREE_LIMIT - used);
  }
  function canUse(tool) { return hasAccess(tool) || usesLeft(tool) > 0; }
  /* Gate for tool buttons: true = may proceed; false = a modal was opened. */
  function checkAccess(tool) {
    if (hasAccess(tool)) return true;
    if (needsToolPick()) { openToolsModal(false); return false; }
    if (usesLeft(tool) > 0) return true;
    showUpgrade(tool);
    return false;
  }
  function consumeUse(tool) {
    if (hasAccess(tool)) return;
    var key = "at_use_" + tool + "_" + todayKey();
    var used = parseInt(localStorage.getItem(key) || "0", 10);
    try { localStorage.setItem(key, String(used + 1)); } catch (e) {}
    refreshUsageNotes();
  }

  /* ---------- modals ---------- */
  function openModal(id) {
    var m = document.getElementById(id);
    if (m) m.classList.add("show");
  }
  function closeModals() {
    document.querySelectorAll(".modal-backdrop.show").forEach(function (m) { m.classList.remove("show"); });
  }
  function showUpgrade(toolId) {
    var t = toolById(toolId);
    var name = t ? t.name : "this tool";
    var title = document.getElementById("at-upgrade-title");
    var body = document.getElementById("at-upgrade-body");
    var changeBtn = document.getElementById("at-upgrade-change");
    var pro = !!getPro();
    if (title) title.textContent = "Daily free limit reached";
    if (changeBtn) changeBtn.style.display = pro ? "" : "none";
    if (body) {
      if (pro) {
        body.innerHTML = "You have used your " + AT_FREE_LIMIT + " free uses of <strong>" + escHtml(name) +
          "</strong> today. Your Pro plan covers " + AT_PRO_TOOL_LIMIT +
          " tools \u2014 switch your selection to include this one, or keep using it free tomorrow.";
      } else {
        body.innerHTML = "You have used your " + AT_FREE_LIMIT + " free uses of <strong>" + escHtml(name) +
          "</strong> today. Upgrade to <strong>Pro (Rs. 500/month)</strong> and pick any " + AT_PRO_TOOL_LIMIT +
          " tools for unlimited access.";
      }
    }
    openModal("at-upgrade-modal");
  }

  /* Pro tool picker: choose any AT_PRO_TOOL_LIMIT tools for unlimited use. */
  function openToolsModal(isFirst) {
    var grid = document.getElementById("at-tools-grid");
    if (!grid) return;
    var err = document.getElementById("at-tools-error");
    var title = document.getElementById("at-tools-title");
    var admin = isAdmin();
    if (title) title.textContent = isFirst ? "Welcome to Pro! Choose your 2 tools" : "My Pro tools \u2014 pick any 2";
    if (err) { err.textContent = ""; err.classList.remove("show"); }
    var selected = {};
    proTools().forEach(function (id) { selected[id] = true; });
    grid.innerHTML = "";
    AT_TOOLS.forEach(function (tool) {
      var card = document.createElement("button");
      card.type = "button";
      card.className = "tool-pick" + (selected[tool.id] || admin ? " on" : "");
      card.innerHTML = '<span class="tp-ico">' + tool.icon + '</span><span class="tp-name">' + escHtml(tool.name) + "</span>";
      if (admin) {
        card.disabled = true;
        card.title = "Admin: all tools unlocked";
      } else {
        card.addEventListener("click", function () {
          if (selected[tool.id]) { delete selected[tool.id]; card.classList.remove("on"); }
          else {
            if (Object.keys(selected).length >= AT_PRO_TOOL_LIMIT) {
              if (err) { err.textContent = "You can pick up to " + AT_PRO_TOOL_LIMIT + " tools. Unselect one first."; err.classList.add("show"); }
              return;
            }
            selected[tool.id] = true; card.classList.add("on");
          }
          if (err) { err.textContent = ""; err.classList.remove("show"); }
        });
      }
      grid.appendChild(card);
    });
    var save = document.getElementById("at-tools-save");
    if (save) {
      save.style.display = admin ? "none" : "";
      save.onclick = function () {
        var ids = Object.keys(selected);
        if (!ids.length) { if (err) { err.textContent = "Please pick at least 1 tool."; err.classList.add("show"); } return; }
        var p = getPro();
        if (!p) { closeModals(); return; }
        p.tools = ids.slice(0, AT_PRO_TOOL_LIMIT);
        try { localStorage.setItem("at_pro", JSON.stringify(p)); } catch (e) {}
        setBadge(); refreshUsageNotes(); closeModals();
        var names = p.tools.map(function (id) { var x = toolById(id); return x ? x.name : id; });
        alert("Done! Unlimited access to: " + names.join(" + ") + ".");
      };
    }
    openModal("at-tools-modal");
  }
  function openCodeModal() {
    var err = document.getElementById("at-code-error");
    if (err) { err.classList.remove("show"); err.textContent = ""; }
    openModal("at-code-modal");
    var inp = document.getElementById("at-code-input");
    if (inp) setTimeout(function () { inp.focus(); }, 100);
  }

  function setBadge() {
    var badge = document.getElementById("at-pro-badge");
    var unlockBtn = document.getElementById("at-unlock-link");
    if (isAdmin()) {
      if (badge) { badge.textContent = "Admin access"; badge.classList.add("show"); }
      if (unlockBtn) unlockBtn.textContent = "Admin";
    } else {
      var pro = getPro();
      if (pro) {
        var d = new Date(pro.expiresAt);
        var n = proTools().length;
        if (badge) {
          badge.textContent = "Pro until " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
            (n ? " \u2022 " + n + "/" + AT_PRO_TOOL_LIMIT + " tools" : "");
          badge.classList.add("show");
        }
        if (unlockBtn) unlockBtn.textContent = n ? "My Tools" : "Pick My Tools";
      } else {
        if (badge) badge.classList.remove("show");
        if (unlockBtn) unlockBtn.textContent = "Unlock Pro";
      }
    }
  }

  function refreshUsageNotes() {
    document.querySelectorAll("[data-usage-note]").forEach(function (el) {
      var tool = el.getAttribute("data-usage-note");
      if (hasAccess(tool)) {
        el.textContent = isAdmin() ? "Admin access: unlimited uses." : "Pro active: unlimited uses of this tool.";
      } else {
        var left = usesLeft(tool);
        el.textContent = left + " of " + AT_FREE_LIMIT + " free uses left today. Need more? ";
        var a = document.createElement("a");
        a.href = "pricing.html";
        a.textContent = "Go Pro";
        el.appendChild(a);
        el.appendChild(document.createTextNode("."));
      }
    });
  }

  function normalizeCode(raw) {
    return (raw || "").trim().toUpperCase().replace(/[\s_]+/g, "");
  }

  function redeemCode(raw) {
    var code = normalizeCode(raw);
    var errEl = document.getElementById("at-code-error");
    var submitBtn = document.getElementById("at-code-submit");
    function fail(msg) {
      if (errEl) { errEl.textContent = msg; errEl.classList.add("show"); }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Activate Pro"; }
      return false;
    }
    if (!code) return fail("Please enter your activation code.");
    if (errEl) { errEl.classList.remove("show"); errEl.textContent = ""; }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Checking..."; }
    function done() {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Activate Pro"; }
    }
    // Codes are verified securely on the server. This file holds no secrets.
    return fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code })
    })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false }; });
      })
      .then(function (data) {
        done();
        if (!data || !data.ok) {
          return fail("This code is not valid. Please check it and try again, or contact us on WhatsApp.");
        }
        var now = Date.now();
        if (data.type === "admin") {
          try { localStorage.setItem("at_admin", JSON.stringify({ t: now })); } catch (e) {}
          setBadge(); refreshUsageNotes(); closeModals();
          alert("Welcome! Admin access activated — unlimited uses, forever.");
          return true;
        }
        try {
          localStorage.setItem("at_pro", JSON.stringify({ activatedAt: now, expiresAt: now + AT_MS_30_DAYS, tools: [] }));
        } catch (e) {}
        setBadge(); refreshUsageNotes(); closeModals();
        openToolsModal(true);
        return true;
      })
      .catch(function () {
        done();
        return fail("Could not reach the server. Check your connection and try again.");
      });
  }

  /* ---------- WhatsApp link generator ---------- */
  function normalizePkNumber(raw) {
    var v = (raw || "").replace(/[\s\-()]/g, "");
    if (v.charAt(0) === "+") v = v.slice(1);
    if (/^03\d{9}$/.test(v)) return "92" + v.slice(1);      // 03XXXXXXXXX
    if (/^3\d{9}$/.test(v)) return "92" + v;                 // 3XXXXXXXXX
    if (/^923\d{9}$/.test(v)) return v;                      // 92XXXXXXXXXX
    return null;
  }

  function initWaTool() {
    var btn = document.getElementById("wa-generate");
    if (!btn) return;
    var phoneEl = document.getElementById("wa-phone");
    var msgEl = document.getElementById("wa-message");
    var errEl = document.getElementById("wa-error");
    var resEl = document.getElementById("wa-result");
    var outEl = document.getElementById("wa-link-output");

    function showErr(msg) { errEl.textContent = msg; errEl.classList.add("show"); resEl.classList.remove("show"); }

    btn.addEventListener("click", function () {
      errEl.classList.remove("show");
      var num = normalizePkNumber(phoneEl.value);
      if (!num) {
        showErr("Please enter a valid Pakistani mobile number, e.g. 0321 4930875.");
        return;
      }
      if (!checkAccess("wa-link")) return;
      var link = "https://wa.me/" + num;
      var msg = (msgEl.value || "").trim();
      if (msg) link += "?text=" + encodeURIComponent(msg);
      outEl.textContent = link;
      resEl.classList.add("show");
      consumeUse("wa-link");
    });

    document.getElementById("wa-copy").addEventListener("click", function () {
      var text = outEl.textContent;
      function done() {
        var b = document.getElementById("wa-copy");
        b.textContent = "Copied!";
        setTimeout(function () { b.textContent = "Copy Link"; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      } else { fallbackCopy(text); done(); }
    });
    function fallbackCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
    document.getElementById("wa-open").addEventListener("click", function () {
      window.open(outEl.textContent, "_blank", "noopener");
    });
  }

  /* ---------- SEO checker (automatic — server-side analysis) ---------- */
  var SEO_STATUS_ICON = { pass: "\u2713", warn: "!", fail: "\u2717" };

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initSeoTool() {
    var btn = document.getElementById("seo-check");
    if (!btn) return;

    function showSeoError(msg) {
      var errEl = document.getElementById("seo-error");
      errEl.textContent = msg;
      errEl.classList.add("show");
    }

    function renderSeoResults(data) {
      var html = "<h3>Results for " + escHtml(data.host) +
        ' <span class="seo-meta">(' + data.sizeKb + " KB, checked in " + (data.fetchedMs / 1000).toFixed(1) + "s)</span></h3>";
      html += '<div class="seo-list">';
      data.checks.forEach(function (c) {
        html += '<div class="seo-row ' + c.status + '">' +
          '<span class="seo-ico" aria-hidden="true">' + SEO_STATUS_ICON[c.status] + "</span>" +
          '<div class="seo-body"><strong>' + escHtml(c.label) + "</strong>" +
          "<span>" + escHtml(c.detail) + "</span>" +
          (c.tip ? '<span class="seo-tip">\uD83D\uDC49 ' + escHtml(c.tip) + "</span>" : "") +
          "</div></div>";
      });
      html += "</div>";
      var failed = data.checks.filter(function (c) { return c.status === "fail"; }).length;
      if (failed) {
        var waText = "Assalam-o-Alaikum! I checked my website (" + data.host + ") on Areesha Tools and got " + data.score + "/100. Can you help me fix it?";
        html += '<p class="seo-cta">Want these fixed properly? <a href="https://wa.me/' + AT_WA_NUMBER + '?text=' + encodeURIComponent(waText) + '" target="_blank" rel="noopener">Chat with Areesha on WhatsApp</a> for a professional audit.</p>';
      } else {
        html += '<p class="seo-cta">\uD83C\uDF89 Great job! Keep your content fresh and keep collecting Google reviews to stay ahead.</p>';
      }
      document.getElementById("seo-results").innerHTML = html;

      var wrap = document.getElementById("seo-score");
      wrap.classList.add("show");
      var numEl = document.getElementById("seo-score-num");
      var gradeEl = document.getElementById("seo-score-grade");
      var score = data.score, start = null, dur = 900;
      function frame(ts) {
        if (!start) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        numEl.textContent = Math.round(score * p);
        if (p < 1) requestAnimationFrame(frame);
        else { numEl.textContent = score; gradeEl.textContent = data.grade + " \u2014 " + score + "/100"; }
      }
      requestAnimationFrame(frame);
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    btn.addEventListener("click", function () {
      var urlEl = document.getElementById("seo-url");
      var raw = (urlEl.value || "").trim();
      document.getElementById("seo-error").classList.remove("show");
      if (!raw) { showSeoError("Please enter your website address."); return; }
      if (!checkAccess("seo-check")) return;

      btn.disabled = true;
      btn.textContent = "Checking...";
      document.getElementById("seo-score").classList.remove("show");

      fetch("/api/seo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw })
      })
        .then(function (r) {
          return r.json().catch(function () { return { ok: false, error: "Server error. Please try again." }; });
        })
        .then(function (data) {
          btn.disabled = false;
          btn.textContent = "Check My Website";
          if (!data || !data.ok) { showSeoError((data && data.error) || "Could not check that website."); return; }
          renderSeoResults(data);
          consumeUse("seo-check");
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Check My Website";
          showSeoError("Could not reach the server. Check your connection and try again.");
        });
    });
  }

  /* ---------- QR generator ---------- */
  function initQrTool() {
    var btn = document.getElementById("qr-generate");
    if (!btn) return;
    var inputEl = document.getElementById("qr-text");
    var errEl = document.getElementById("qr-error");
    var box = document.getElementById("qr-box");
    var dlWrap = document.getElementById("qr-download-wrap");

    if (typeof QRCode === "undefined") {
      errEl.textContent = "QR library could not load (check your internet connection) — the rest of the site still works.";
      errEl.classList.add("show");
      btn.disabled = true;
      return;
    }
    var qr = null;
    btn.addEventListener("click", function () {
      errEl.classList.remove("show");
      var text = (inputEl.value || "").trim();
      if (!text) { errEl.textContent = "Please enter some text or a link first."; errEl.classList.add("show"); return; }
      if (text.length > 2000) { errEl.textContent = "Too long — please keep it under 2000 characters."; errEl.classList.add("show"); return; }
      if (!checkAccess("qr-gen")) return;
      box.innerHTML = "";
      try {
        qr = new QRCode(box, { text: text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
      } catch (e) {
        errEl.textContent = "Could not generate the QR code. Please try shorter text.";
        errEl.classList.add("show");
        return;
      }
      dlWrap.style.display = "block";
      consumeUse("qr-gen");
    });

    document.getElementById("qr-download").addEventListener("click", function () {
      var canvas = box.querySelector("canvas");
      var img = box.querySelector("img");
      var src = null;
      if (canvas) { try { src = canvas.toDataURL("image/png"); } catch (e) {} }
      if (!src && img && img.src) src = img.src;
      if (!src) return;
      var a = document.createElement("a");
      a.href = src; a.download = "qr-code.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
  }


  /* ---------- Invoice generator ---------- */
  function initInvoiceTool() {
    var addBtn = document.getElementById("inv-add-item");
    if (!addBtn) return;
    var itemsEl = document.getElementById("inv-items");
    function addRow() {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td><input type="text" class="inv-desc" placeholder="Service / product"></td>' +
        '<td><input type="number" class="inv-qty" value="1" min="1"></td>' +
        '<td><input type="number" class="inv-rate" placeholder="0" min="0"></td>' +
        '<td><button type="button" class="inv-del btn small secondary">×</button></td>';
      tr.querySelector(".inv-del").addEventListener("click", function () { tr.remove(); });
      itemsEl.appendChild(tr);
    }
    addBtn.addEventListener("click", addRow);
    addRow();

    document.getElementById("inv-generate").addEventListener("click", function () {
      if (!checkAccess("invoice")) return;
      var biz = document.getElementById("inv-biz").value.trim() || "Your Business";
      var num = document.getElementById("inv-num").value.trim() || "001";
      var date = document.getElementById("inv-date").value || new Date().toISOString().slice(0, 10);
      var billTo = document.getElementById("inv-billto").value.trim();
      var taxPct = parseFloat(document.getElementById("inv-tax").value) || 0;
      var notes = document.getElementById("inv-notes").value.trim();
      var rows = itemsEl.querySelectorAll("tr");
      var items = [];
      rows.forEach(function (tr) {
        var d = tr.querySelector(".inv-desc").value.trim();
        var q = parseFloat(tr.querySelector(".inv-qty").value) || 0;
        var r = parseFloat(tr.querySelector(".inv-rate").value) || 0;
        if (d && q > 0) items.push({ d: d, q: q, r: r });
      });
      var errEl = document.getElementById("inv-error");
      if (!items.length) { errEl.textContent = "Please add at least one item with quantity."; errEl.classList.add("show"); return; }
      errEl.classList.remove("show");
      var sub = items.reduce(function (s, it) { return s + it.q * it.r; }, 0);
      var tax = sub * taxPct / 100;
      var total = sub + tax;
      function fmt(n) { return "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 0 }); }
      var html = '<div class="inv-doc"><h2>' + escHtml(biz) + "</h2>" +
        '<div class="inv-meta"><span>Invoice #' + escHtml(num) + "</span><span>Date: " + escHtml(date) + "</span></div>" +
        (billTo ? '<p><strong>Bill to:</strong> ' + escHtml(billTo) + "</p>" : "") +
        '<table class="inv-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' +
        items.map(function (it) {
          return "<tr><td>" + escHtml(it.d) + "</td><td>" + it.q + "</td><td>" + fmt(it.r) + "</td><td>" + fmt(it.q * it.r) + "</td></tr>";
        }).join("") + "</tbody></table>" +
        '<div class="inv-totals"><p>Subtotal: ' + fmt(sub) + "</p>" +
        (taxPct ? "<p>Tax (" + taxPct + "%): " + fmt(tax) + "</p>" : "") +
        "<p class='grand'>Total: " + fmt(total) + "</p></div>" +
        (notes ? '<p class="inv-notes"><strong>Notes:</strong> ' + escHtml(notes) + "</p>" : "") + "</div>";
      var prev = document.getElementById("inv-preview");
      prev.innerHTML = html;
      document.getElementById("inv-result").classList.add("show");
      consumeUse("invoice");
    });
    document.getElementById("inv-print").addEventListener("click", function () { window.print(); });
  }

  /* ---------- Google review link generator ---------- */
  function initReviewTool() {
    var btn = document.getElementById("rev-generate");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!checkAccess("review-link")) return;
      var pid = document.getElementById("rev-placeid").value.trim();
      var errEl = document.getElementById("rev-error");
      if (!pid) { errEl.textContent = "Please paste your Google Place ID."; errEl.classList.add("show"); return; }
      errEl.classList.remove("show");
      var link = "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(pid);
      document.getElementById("rev-output").textContent = link;
      document.getElementById("rev-result").classList.add("show");
      var qbox = document.getElementById("rev-qr");
      qbox.innerHTML = "";
      if (typeof QRCode !== "undefined") { new QRCode(qbox, { text: link, width: 160, height: 160 }); }
      consumeUse("review-link");
    });
    function copyOut(id, doneId) {
      var t = document.getElementById(id).textContent;
      var d = document.getElementById(doneId);
      function done() { d.textContent = "Copied!"; setTimeout(function () { d.textContent = "Copy Link"; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
      else done();
    }
    document.getElementById("rev-copy").addEventListener("click", function () { copyOut("rev-output", "rev-copy"); });
    document.getElementById("rev-open").addEventListener("click", function () {
      window.open(document.getElementById("rev-output").textContent, "_blank", "noopener");
    });
  }

  /* ---------- Ad headline generator ---------- */
  var AD_TEMPLATES = [
    "{offer} — sirf {biz} par! Aaj hi rabta karein.",
    "Stop scrolling! {biz} laya {offer}.",
    "{city} walon ke liye khushkhabri: {offer} ab {biz} par.",
    "Kya aap ne {offer} try kiya? {biz} — quality ki guarantee.",
    "{offer} chahiye? {biz} se behtar option nahi milega.",
    "Limited time: {offer} — {biz} par booking shuru!",
    "Mehngai ke daur mein sasta aur mayari: {offer} by {biz}.",
    "{biz} ka wada — {offer}, warna paise wapas!",
    "Doston ko tag karein jinhe {offer} chahiye — {biz}.",
    "Pehli visit par khaas discount: {offer} at {biz}.",
    "{city} ka most trusted: {biz} presents {offer}.",
    "Ab ghar baithe hasil karein: {offer} — {biz}."
  ];
  function initAdTool() {
    var btn = document.getElementById("ad-generate");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!checkAccess("ad-headline")) return;
      var biz = document.getElementById("ad-biz").value.trim() || "Your Business";
      var offer = document.getElementById("ad-offer").value.trim() || "our special offer";
      var city = document.getElementById("ad-city").value.trim() || "your city";
      var list = document.getElementById("ad-list");
      list.innerHTML = "";
      AD_TEMPLATES.forEach(function (tpl, i) {
        var text = tpl.split("{biz}").join(biz).split("{offer}").join(offer).split("{city}").join(city);
        var div = document.createElement("div");
        div.className = "ad-item";
        div.innerHTML = "<span>" + escHtml(text) + "</span>";
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn small secondary"; b.textContent = "Copy";
        b.addEventListener("click", function () {
          function done() { b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy"; }, 1200); }
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
          else done();
        });
        div.appendChild(b);
        list.appendChild(div);
      });
      document.getElementById("ad-result").classList.add("show");
      consumeUse("ad-headline");
    });
  }

  /* ---------- Image compressor (100% in-browser) ---------- */
  function initImgTool() {
    var fileEl = document.getElementById("img-file");
    if (!fileEl) return;
    var origData = null, origSize = 0, origName = "";
    fileEl.addEventListener("change", function () {
      var f = fileEl.files && fileEl.files[0];
      if (!f) return;
      origName = f.name.replace(/\.[^.]+$/, "") || "image";
      origSize = f.size;
      var rd = new FileReader();
      rd.onload = function () {
        origData = rd.result;
        var img = new Image();
        img.onload = function () {
          document.getElementById("img-orig-info").textContent =
            "Original: " + img.naturalWidth + "×" + img.naturalHeight + "px, " + (origSize / 1024).toFixed(0) + " KB";
          document.getElementById("img-preview-orig").src = origData;
          document.getElementById("img-settings").classList.add("show");
        };
        img.src = origData;
      };
      rd.readAsDataURL(f);
    });
    document.getElementById("img-compress-btn").addEventListener("click", function () {
      if (!checkAccess("img-compress")) return;
      if (!origData) return;
      var quality = parseFloat(document.getElementById("img-quality").value) || 0.7;
      var maxW = parseInt(document.getElementById("img-maxw").value, 10) || 1600;
      document.getElementById("img-q-label").textContent = Math.round(quality * 100) + "%";
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxW / img.naturalWidth);
        var w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        var out = c.toDataURL("image/jpeg", quality);
        var compSize = Math.round(out.length * 0.75);
        document.getElementById("img-preview-new").src = out;
        var saved = origSize > 0 ? Math.max(0, Math.round((1 - compSize / origSize) * 100)) : 0;
        document.getElementById("img-new-info").textContent =
          "Compressed: " + w + "×" + h + "px, " + (compSize / 1024).toFixed(0) + " KB (" + saved + "% smaller)";
        var dl = document.getElementById("img-download");
        dl.href = out; dl.download = origName + "-compressed.jpg";
        document.getElementById("img-result").classList.add("show");
        consumeUse("img-compress");
      };
      img.src = origData;
    });
    document.getElementById("img-quality").addEventListener("input", function (e) {
      document.getElementById("img-q-label").textContent = Math.round(parseFloat(e.target.value) * 100) + "%";
    });
  }

  /* ---------- Hashtag generator ---------- */
  var HASHTAGS = {
    beauty: ["#beauty", "#makeup", "#skincare", "#beautytips", "#pakistanimakeup", "#desimakeup", "#glowingskin", "#beautyblogger", "#makeupartist", "#bridalmakeup", "#lahoremakeup", "#karachibeauty", "#hudabeauty", "#naturalmakeup", "#beautyparlour", "#salonlife", "#hairgoals", "#nailart", "#mehndi", "#fashion"],
    clinic: ["#dentist", "#dentistry", "#smile", "#dentalcare", "#teethwhitening", "#oralhealth", "#lahoredentist", "#karachiclinic", "#skincare", "#dermatologist", "#healthcare", "#clinic", "#doctor", "#medical", "#healthtips", "#aesthetic", "#lasertreatment", "#hydrafacial", "#prp", "#wellness"],
    food: ["#foodie", "#foodlover", "#desifood", "#pakistanifood", "#lahorefood", "#karachifood", "#foodblogger", "#biryani", "#bbq", "#streetfood", "#homemade", "#recipe", "#foodphotography", "#instafood", "#yummy", "#dinner", "#lunch", "#breakfast", "#chai", "#dessert"],
    fashion: ["#fashion", "#style", "#ootd", "#pakistanifashion", "#desifashion", "#kurti", "#lawn", "#eidcollection", "#onlineshopping", "#boutique", "#designerwear", "#ethnicwear", "#fashionblogger", "#instastyle", "#shopping", "#newcollection", "#sale", "#pret", "#formalwear", "#casualstyle"],
    realestate: ["#realestate", "#property", "#investment", "#lahoreproperty", "#karachiproperty", "#dha", "#bahriatown", "#plotforsale", "#houseforsale", "#realtor", "#propertydealer", "#dreamhome", "#newhome", "#construction", "#pakistanproperty", "#commercial", "#rental", "#housing", "#land", "#propertyinvestment"],
    business: ["#smallbusiness", "#entrepreneur", "#startup", "#pakistanibusiness", "#supportlocal", "#shoplocal", "#businessowner", "#onlineshop", "#ecommerce", "#marketing", "#digitalmarketing", "#branding", "#success", "#motivation", "#womeninbusiness", "#freelancer", "#workfromhome", "#sidehustle", "#growth", "#customers"]
  };
  function initHashtagTool() {
    var btn = document.getElementById("ht-generate");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!checkAccess("hashtag")) return;
      var niche = document.getElementById("ht-niche").value;
      var tags = HASHTAGS[niche] || [];
      var box = document.getElementById("ht-output");
      box.textContent = tags.join(" ");
      document.getElementById("ht-result").classList.add("show");
      consumeUse("hashtag");
    });
    document.getElementById("ht-copy").addEventListener("click", function () {
      var t = document.getElementById("ht-output").textContent;
      var b = document.getElementById("ht-copy");
      function done() { b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy All"; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
      else done();
    });
  }

  /* ---------- UTM link builder ---------- */
  function initUtmTool() {
    var btn = document.getElementById("utm-generate");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!checkAccess("utm")) return;
      var url = document.getElementById("utm-url").value.trim();
      var errEl = document.getElementById("utm-error");
      if (!url) { errEl.textContent = "Please enter your page URL."; errEl.classList.add("show"); return; }
      var withProto = /^https?:\/\//i.test(url) ? url : "https://" + url;
      var u;
      try { u = new URL(withProto); }
      catch (e) { errEl.textContent = "That doesn't look like a valid URL."; errEl.classList.add("show"); return; }
      errEl.classList.remove("show");
      var p = u.searchParams;
      var src = document.getElementById("utm-source").value.trim();
      var med = document.getElementById("utm-medium").value.trim();
      var camp = document.getElementById("utm-campaign").value.trim();
      if (src) p.set("utm_source", src);
      if (med) p.set("utm_medium", med);
      if (camp) p.set("utm_campaign", camp);
      var term = document.getElementById("utm-term").value.trim();
      var content = document.getElementById("utm-content").value.trim();
      if (term) p.set("utm_term", term);
      if (content) p.set("utm_content", content);
      document.getElementById("utm-output").textContent = u.toString();
      document.getElementById("utm-result").classList.add("show");
      consumeUse("utm");
    });
    document.getElementById("utm-copy").addEventListener("click", function () {
      var t = document.getElementById("utm-output").textContent;
      var b = document.getElementById("utm-copy");
      function done() { b.textContent = "Copied!"; setTimeout(function () { b.textContent = "Copy Link"; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done);
      else done();
    });
  }

  /* ---------- init ---------- */
  function injectModals() {
    if (document.getElementById("at-upgrade-modal")) return;
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="modal-backdrop" id="at-upgrade-modal"><div class="modal" role="dialog" aria-modal="true">' +
      '<button class="close-x" data-close aria-label="Close">×</button>' +
      '<h3 id="at-upgrade-title">Daily free limit reached</h3>' +
      '<p id="at-upgrade-body"></p>' +
      '<div class="row"><a class="btn" href="pricing.html">View Pricing</a>' +
      '<button class="btn secondary" id="at-modal-code-btn">Enter Pro Code</button>' +
      '<button class="btn secondary" id="at-upgrade-change" style="display:none">Change My 2 Tools</button></div></div></div>' +
      '<div class="modal-backdrop" id="at-code-modal"><div class="modal" role="dialog" aria-modal="true">' +
      '<button class="close-x" data-close aria-label="Close">×</button>' +
      "<h3>Unlock Pro</h3>" +
      "<p>Enter the Pro activation code you received after payment.</p>" +
      '<div class="field"><label for="at-code-input">Activation code</label>' +
      '<input type="text" id="at-code-input" placeholder="AREESHA-XXXX-XXXX" autocomplete="off" spellcheck="false"></div>' +
      '<div class="error" id="at-code-error"></div>' +
      '<div class="row"><button class="btn" id="at-code-submit">Activate Pro</button></div>' +
      '<p style="margin-top:12px">No code yet? <a href="pricing.html">Get Pro for Rs. 500/month</a></p>' +
      "</div></div>" +
      '<div class="modal-backdrop" id="at-tools-modal"><div class="modal wide" role="dialog" aria-modal="true">' +
      '<button class="close-x" data-close aria-label="Close">×</button>' +
      '<h3 id="at-tools-title">Choose your 2 tools</h3>' +
      "<p>Your <strong>Pro (Rs. 500/month)</strong> subscription gives you <strong>unlimited</strong> use of any 2 tools. Tap to pick yours:</p>" +
      '<div class="tool-pick-grid" id="at-tools-grid"></div>' +
      '<div class="error" id="at-tools-error"></div>' +
      '<div class="row"><button class="btn" id="at-tools-save" type="button">Save My Tools</button></div>' +
      '<p class="fine">You can change your selection anytime from the \u201CMy Tools\u201D button.</p>' +
      "</div></div>";
    document.body.appendChild(div);
    document.querySelectorAll(".modal-backdrop").forEach(function (m) {
      m.addEventListener("click", function (e) {
        if (e.target === m || e.target.hasAttribute("data-close")) closeModals();
      });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });
    document.getElementById("at-modal-code-btn").addEventListener("click", function () {
      closeModals(); openCodeModal();
    });
    document.getElementById("at-upgrade-change").addEventListener("click", function () {
      closeModals(); openToolsModal(false);
    });
    document.getElementById("at-code-submit").addEventListener("click", function () {
      redeemCode(document.getElementById("at-code-input").value);
    });
    document.getElementById("at-code-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") redeemCode(e.target.value);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    injectModals();
    setBadge();
    refreshUsageNotes();
    var unlock = document.getElementById("at-unlock-link");
    if (unlock) unlock.addEventListener("click", function (e) {
      e.preventDefault();
      if (getPro() || isAdmin()) openToolsModal(false); else openCodeModal();
    });
    var pricingForm = document.getElementById("at-pricing-code-form");
    if (pricingForm) {
      pricingForm.addEventListener("submit", function (e) {
        e.preventDefault();
        redeemCode(document.getElementById("at-pricing-code-input").value);
      });
    }
    initWaTool();
    initSeoTool();
    initQrTool();
    initInvoiceTool();
    initReviewTool();
    initAdTool();
    initImgTool();
    initHashtagTool();
    initUtmTool();
  });

  /* expose for inline handlers / testing */
  window.atRedeemCode = redeemCode;
  window.atUsesLeft = usesLeft;
  window.atHasAccess = hasAccess;
})();
