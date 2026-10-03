/* THE FORGERY LAB — tipnotary lesson, playable. No build step, classic script. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder();
  var ZERO = '0'.repeat(64);

  async function sha256hex(msg) {
    var d = await crypto.subtle.digest('SHA-256', enc.encode(msg));
    var a = new Uint8Array(d), out = '';
    for (var i = 0; i < a.length; i++) { out += a[i].toString(16).padStart(2, '0'); }
    return out;
  }

  var HONEST = [
    'b0 genesis: fleet ledger opened',
    'b1 agent-0001 face sha256=14e1ecf8\u2026',
    'b2 agent-0001 paid 10 credits',
    'b3 checkpoint: 3 entries'
  ];
  var TAMPER = 'b2 agent-0001 paid 100000 credits (forged)';
  var TAMPER_IDX = 2;

  var chain = [];
  var anchor = '';

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  async function build() {
    chain = [];
    var prev = ZERO;
    for (var i = 0; i < HONEST.length; i++) {
      var hash = await sha256hex(HONEST[i] + prev);
      chain.push({ msg: HONEST[i], prev: prev, hash: hash });
      prev = hash;
    }
  }

  async function render() {
    var wrap = $('chain');
    wrap.innerHTML = '';
    var linkBrokenAt = -1;
    for (var i = 1; i < chain.length; i++) {
      if (chain[i].prev !== chain[i - 1].hash) { linkBrokenAt = i; break; }
    }
    for (var j = 0; j < chain.length; j++) {
      var b = chain[j];
      var localOk = (await sha256hex(b.msg + b.prev)) === b.hash;
      var linkOk = (j === 0) || (b.prev === chain[j - 1].hash);
      var el = document.createElement('div');
      el.className = 'block' + (linkOk ? '' : ' broken');
      el.innerHTML =
        '<div class="blk-h">block ' + j + (j === 0 ? ' \u00b7 genesis' : '') +
          '<span class="badge ' + (localOk ? 'ok' : 'bad') + '">' + (localOk ? 'hash ' : 'hash ') + (localOk ? '\u2713' : '\u2717') + '</span>' +
          '<span class="badge ' + (linkOk ? 'ok' : 'bad') + '">link ' + (linkOk ? '\u2713' : '\u2717') + '</span>' +
        '</div>' +
        '<div class="blk-msg">' + esc(b.msg) + '</div>' +
        '<div class="blk-row"><span>prev</span><code title="' + b.prev + '">' + b.prev.slice(0, 16) + '\u2026</code></div>' +
        '<div class="blk-row"><span>hash</span><code title="' + b.hash + '">' + b.hash.slice(0, 16) + '\u2026</code></div>';
      wrap.appendChild(el);
    }

    var v = $('verify');
    v.className = 'verdict';
    if (linkBrokenAt >= 0) {
      v.textContent = 'CHAIN BROKEN at block ' + linkBrokenAt;
      v.classList.add('bad');
    } else {
      v.textContent = 'self-consistent \u2713  (all prev-hash links valid)';
      v.classList.add('ok');
    }

    var tip = chain[chain.length - 1].hash;
    var a = $('anchor-verdict');
    a.className = 'verdict';
    if (anchor && tip === anchor) {
      a.textContent = 'tip MATCHES external anchor \u2713';
      a.classList.add('ok');
    } else {
      a.textContent = 'SELF-CONSISTENT \u2717 FORGED \u2014 anchor mismatch';
      a.classList.add('bad');
    }
    $('tip').textContent = tip;
  }

  async function load() {
    await build();
    anchor = chain[chain.length - 1].hash;
    $('anchor-hash').textContent = anchor;
    $('anchor-hash').title = anchor;
    await render();
  }

  async function tamperOnly() {
    // self-consistent forgery: rewrite block 2's msg, recompute ONLY block 2's hash
    chain[TAMPER_IDX].msg = TAMPER;
    chain[TAMPER_IDX].hash = await sha256hex(TAMPER + chain[TAMPER_IDX].prev);
    await render();
  }

  async function rewrite() {
    // self-consistent rewrite: recompute block 2 AND all downstream links/hashes
    chain[TAMPER_IDX].msg = TAMPER;
    chain[TAMPER_IDX].hash = await sha256hex(TAMPER + chain[TAMPER_IDX].prev);
    for (var i = TAMPER_IDX + 1; i < chain.length; i++) {
      chain[i].prev = chain[i - 1].hash;
      chain[i].hash = await sha256hex(chain[i].msg + chain[i].prev);
    }
    await render();
  }

  window.addEventListener('DOMContentLoaded', function () {
    if (!(window.crypto && window.crypto.subtle)) {
      var v = $('verify');
      v.textContent = 'crypto.subtle unavailable (needs HTTPS/localhost) \u2014 lab disabled.';
      v.className = 'verdict bad';
      return;
    }
    $('btn-tamper').addEventListener('click', tamperOnly);
    $('btn-rewrite').addEventListener('click', rewrite);
    $('btn-reset').addEventListener('click', load);
    load();
  });
})();
