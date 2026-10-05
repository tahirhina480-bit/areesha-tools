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
  function hasAccess() { return isAdmin() || !!getPro(); }

  function usesLeft(tool) {
    if (hasAccess()) return Infinity;
    var used = parseInt(localStorage.getItem("at_use_" + tool + "_" + todayKey()) || "0", 10);
    return Math.max(0, AT_FREE_LIMIT - used);
  }
  function canUse(tool) { return usesLeft(tool) > 0; }
  function consumeUse(tool) {
    if (hasAccess()) return;
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
  function showUpgrade() { openModal("at-upgrade-modal"); }
  function openCodeModal() {
    var err = document.getElementById("at-code-error");
    if (err) { err.classList.remove("show"); err.textContent = ""; }
    openModal("at-code-modal");
    var inp = document.getElementById("at-code-input");
    if (inp) setTimeout(function () { inp.focus(); }, 100);
  }

  function setBadge() {
    var badge = document.getElementById("at-pro-badge");
    if (!badge) return;
    if (isAdmin()) {
      badge.textContent = "Admin access";
      badge.classList.add("show");
    } else {
      var pro = getPro();
      if (pro) {
        var d = new Date(pro.expiresAt);
        badge.textContent = "Pro active until " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        badge.classList.add("show");
      } else {
        badge.classList.remove("show");
      }
    }
  }

  function refreshUsageNotes() {
    document.querySelectorAll("[data-usage-note]").forEach(function (el) {
      var tool = el.getAttribute("data-usage-note");
      if (hasAccess()) {
        el.textContent = isAdmin() ? "Admin access: unlimited uses." : "Pro active: unlimited uses.";
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
          localStorage.setItem("at_pro", JSON.stringify({ activatedAt: now, expiresAt: now + AT_MS_30_DAYS }));
        } catch (e) {}
        setBadge(); refreshUsageNotes(); closeModals();
        var d = new Date(now + AT_MS_30_DAYS);
        alert("Pro activated! Unlimited access until " + d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + ".");
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
      if (!canUse("wa-link")) { showUpgrade(); return; }
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
      if (!canUse("seo-check")) { showUpgrade(); return; }

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
      if (!canUse("qr-gen")) { showUpgrade(); return; }
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

  /* ---------- init ---------- */
  function injectModals() {
    if (document.getElementById("at-upgrade-modal")) return;
    var div = document.createElement("div");
    div.innerHTML =
      '<div class="modal-backdrop" id="at-upgrade-modal"><div class="modal" role="dialog" aria-modal="true">' +
      '<button class="close-x" data-close aria-label="Close">×</button>' +
      "<h3>Daily free limit reached</h3>" +
      "<p>You have used your " + AT_FREE_LIMIT + " free uses of this tool today. Upgrade to <strong>Pro (Rs. 500/month)</strong> for unlimited access to all tools.</p>" +
      '<div class="row"><a class="btn" href="pricing.html">View Pricing</a>' +
      '<button class="btn secondary" id="at-modal-code-btn">Enter Pro Code</button></div></div></div>' +
      '<div class="modal-backdrop" id="at-code-modal"><div class="modal" role="dialog" aria-modal="true">' +
      '<button class="close-x" data-close aria-label="Close">×</button>' +
      "<h3>Unlock Pro</h3>" +
      "<p>Enter the Pro activation code you received after payment.</p>" +
      '<div class="field"><label for="at-code-input">Activation code</label>' +
      '<input type="text" id="at-code-input" placeholder="AREESHA-XXXX-XXXX" autocomplete="off" spellcheck="false"></div>' +
      '<div class="error" id="at-code-error"></div>' +
      '<div class="row"><button class="btn" id="at-code-submit">Activate Pro</button></div>' +
      '<p style="margin-top:12px">No code yet? <a href="pricing.html">Get Pro for Rs. 500/month</a></p>' +
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
    if (unlock) unlock.addEventListener("click", function (e) { e.preventDefault(); openCodeModal(); });
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
  });

  /* expose for inline handlers / testing */
  window.atRedeemCode = redeemCode;
  window.atUsesLeft = usesLeft;
  window.atHasAccess = hasAccess;
})();
