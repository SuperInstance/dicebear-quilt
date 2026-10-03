/* quilt-avatar playground — no build step, classic script, dynamic import().
 * Renders a DiceBear v11 face from a seed, client-side sha256 receipt.
 * Pinned: @dicebear/core@11.0.0-rc.2 (esm.sh) + @dicebear/styles@11.0.0-rc.3 (jsdelivr). */
(function () {
  'use strict';

  var CORE_URL = 'https://esm.sh/@dicebear/core@11.0.0-rc.2';
  var STYLES_BASE = 'https://cdn.jsdelivr.net/npm/@dicebear/styles@11.0.0-rc.3/dist/';
  var STYLES_VERSION = '11.0.0-rc.3';
  var TOOL = 'quilt-avatar';
  var STYLES = ['bottts', 'adventurer', 'personas', 'pixel-art', 'identicon', 'thumbs', 'fun-emoji', 'shapes'];

  var $ = function (id) { return document.getElementById(id); };
  var mod = null;
  var defCache = {};

  function canonical(obj) {
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + JSON.stringify(obj[k]);
    }).join(',') + '}';
  }
  function enc(s) { return new TextEncoder().encode(s); }
  function hasSubtle() { return !!(window.crypto && window.crypto.subtle); }
  async function sha256hex(bytes) {
    var d = await crypto.subtle.digest('SHA-256', bytes);
    var a = new Uint8Array(d), out = '';
    for (var i = 0; i < a.length; i++) { out += a[i].toString(16).padStart(2, '0'); }
    return out;
  }
  function short(h, n) { return h.slice(0, n || 12) + '\u2026'; }
  function banner(msg) { var b = $('cdn-banner'); if (b) { b.textContent = msg; b.hidden = false; } }

  async function loadCore() {
    if (mod) { return mod; }
    mod = await import(CORE_URL);
    return mod;
  }
  async function loadDef(style) {
    if (defCache[style]) { return defCache[style]; }
    var r = await fetch(STYLES_BASE + style + '.min.json');
    if (!r.ok) { throw new Error('style fetch HTTP ' + r.status); }
    var def = await r.json();
    defCache[style] = def;
    return def;
  }
  function licName(def) {
    var l = def && def.meta && def.meta.license;
    if (!l) { return 'unknown'; }
    return typeof l === 'string' ? l : (l.name || 'unknown');
  }

  async function render(seed, style) {
    var m = await loadCore();
    var def = await loadDef(style);
    var svg = new m.Avatar(new m.Style(def), { seed: seed }).toString();
    return { svg: svg, def: def };
  }

  async function makeReceipt(seed, style, svg, def) {
    var bytes = enc(svg);
    var sha = await sha256hex(bytes);
    return canonical({
      bytes: bytes.length,
      license: licName(def),
      seed: seed,
      sha256: sha,
      style: style,
      styleVersion: STYLES_VERSION,
      tool: TOOL
    });
  }

  var seq = 0;
  async function update() {
    var mySeq = ++seq;
    var seed = $('seed').value || 'agent-0001';
    var style = $('style').value;
    var face = $('face'), receipt = $('receipt'), verdict = $('verdict');
    receipt.textContent = 'rendering\u2026';
    try {
      if (!hasSubtle()) { banner('crypto.subtle unavailable (needs HTTPS/localhost) \u2014 face renders, receipt is disabled.'); }
      var res = await render(seed, style);
      if (mySeq !== seq) { return; }
      face.innerHTML = res.svg;
      receipt.textContent = hasSubtle() ? await makeReceipt(seed, style, res.svg, res.def) : '(receipt needs a secure context)';
      verdict.textContent = '';
      verdict.className = 'verdict';
    } catch (e) {
      if (mySeq !== seq) { return; }
      banner('CDN unreachable \u2014 receipts still valid. ' + (e && e.message ? '(' + e.message + ')' : ''));
      face.innerHTML = '<div class="face-fail">CDN unavailable</div>';
      receipt.textContent = '';
    }
  }

  async function proveIt() {
    var seed = $('seed').value || 'agent-0001';
    var style = $('style').value;
    var v = $('verdict');
    v.className = 'verdict';
    v.textContent = 'rendering twice\u2026';
    try {
      var a = await render(seed, style);
      var b = await render(seed, style);
      var ba = enc(a.svg), bb = enc(b.svg);
      var same = ba.length === bb.length;
      if (same) {
        for (var i = 0; i < ba.length; i++) { if (ba[i] !== bb[i]) { same = false; break; } }
      }
      var ha = hasSubtle() ? await sha256hex(ba) : '';
      var hb = hasSubtle() ? await sha256hex(bb) : '';
      var identical = same && (!ha || ha === hb);
      if (identical) {
        v.textContent = 'IDENTICAL \u2713  two independent renders, ' + ba.length + ' bytes' +
          (ha ? ', sha256 ' + short(ha, 16) : '') + ' \u2014 byte-for-byte equal';
        v.classList.add('ok');
      } else {
        v.textContent = 'DELTA \u2717  renders differ (a=' + short(ha, 12) + ' b=' + short(hb, 12) + ')';
        v.classList.add('bad');
      }
    } catch (e) {
      v.textContent = 'CDN unreachable \u2014 cannot re-render to compare. Receipts remain valid as canonical strings. (' + (e && e.message) + ')';
      v.classList.add('bad');
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    var sel = $('style');
    STYLES.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s; o.textContent = s; sel.appendChild(o);
    });
    sel.value = 'bottts';
    $('seed').value = 'lucineer';
    var deb = null;
    $('seed').addEventListener('input', function () {
      clearTimeout(deb); deb = setTimeout(update, 180);
    });
    sel.addEventListener('change', update);
    $('prove').addEventListener('click', proveIt);
    update();
  });
})();
