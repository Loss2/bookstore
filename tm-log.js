/* Журнал стенда Менеджера тегов.
   Ничего не отправляет и не эмулирует — только показывает, что грузится и что улетает. */
(function () {
  'use strict';

  var MAX = 400;
  var items = [];
  var ui = null;

  var KINDS = {
    container: { label: 'контейнер', color: '#7dd3fc' },
    pixel:     { label: 'пиксель',   color: '#a78bfa' },
    weblayer:  { label: 'веб-слой',  color: '#38bdf8' },
    net:       { label: 'запрос',    color: '#94a3b8' },
    click:     { label: 'клик',      color: '#fbbf24' },
    error:     { label: 'ошибка',    color: '#f87171' },
    nav:       { label: 'переход',   color: '#34d399' },
    info:      { label: 'стенд',     color: '#e2e8f0' }
  };

  function classify(url) {
    var u = String(url);
    if (/\/pixel\?|\/pixel\/|ak_pixel/.test(u)) return 'pixel';
    if (/actm\/js\/actm\.js/.test(u)) return 'container';
    if (/ak_container\.js/.test(u)) return 'weblayer';
    return 'net';
  }

  function shortUrl(url) {
    try {
      var u = new URL(url, location.href);
      if (u.hostname === location.hostname) return u.pathname + (u.search || '');
      var q = u.search.length > 220 ? u.search.slice(0, 220) + '…' : u.search;
      return u.host + u.pathname + q;
    } catch (e) {
      return String(url).slice(0, 140);
    }
  }

  function stamp() {
    var d = new Date();
    function p2(n) { return ('0' + n).slice(-2); }
    return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  }

  function add(kind, text) {
    items.push({ kind: kind, text: text, t: stamp() });
    if (items.length > MAX) items.shift();
    if (ui) paint();
  }

  function row(it) {
    var k = KINDS[it.kind] || KINDS.info;
    var el = document.createElement('div');
    el.style.cssText = 'display:flex;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)';

    var t = document.createElement('span');
    t.textContent = it.t;
    t.style.cssText = 'color:#64748b;flex:0 0 auto';

    var b = document.createElement('span');
    b.textContent = k.label;
    b.style.cssText = 'color:' + k.color + ';flex:0 0 70px;font-weight:600';

    var m = document.createElement('span');
    m.textContent = it.text;
    m.style.cssText = 'color:#cbd5e1;flex:1 1 auto;word-break:break-all';

    el.appendChild(t); el.appendChild(b); el.appendChild(m);
    return el;
  }

  function paint() {
    if (!ui) return;
    var frag = document.createDocumentFragment();
    for (var i = items.length - 1; i >= 0; i--) frag.appendChild(row(items[i]));
    ui.list.textContent = '';
    ui.list.appendChild(frag);
    ui.count.textContent = items.length;
  }

  function build() {
    var box = document.createElement('div');
    box.id = 'tm-log';
    box.style.cssText = [
      'position:fixed', 'right:0', 'bottom:0', 'z-index:2147483647',
      'width:380px', 'max-width:95vw', 'background:rgba(15,23,42,.96)',
      'color:#e2e8f0', 'font:11px/1.45 ui-monospace,Consolas,monospace',
      'box-shadow:0 -6px 24px rgba(0,0,0,.35)', 'border-left:1px solid rgba(255,255,255,.08)'
    ].join(';');

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;background:#0b1220';

    var title = document.createElement('strong');
    title.textContent = 'журнал';
    title.style.cssText = 'color:#f8fafc;font-size:11px;letter-spacing:.04em;text-transform:uppercase';

    var count = document.createElement('span');
    count.textContent = '0';
    count.style.cssText = 'color:#64748b';

    function button(text, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.style.cssText = 'margin-left:auto;background:none;border:1px solid rgba(255,255,255,.18);' +
        'color:#94a3b8;border-radius:4px;padding:1px 6px;font:inherit;cursor:pointer';
      b.addEventListener('click', fn);
      return b;
    }

    var copy = button('копировать', function () {
      var text = items.map(function (it) {
        var k = KINDS[it.kind] || KINDS.info;
        return it.t + '  ' + k.label + '  ' + it.text;
      }).join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      copy.textContent = 'скопировано';
      setTimeout(function () { copy.textContent = 'копировать'; }, 1200);
    });

    var clear = button('очистить', function () { items.length = 0; paint(); });
    clear.style.marginLeft = '6px';

    var list = document.createElement('div');
    list.style.cssText = 'max-height:38vh;overflow:auto;padding:4px 10px 8px';

    bar.appendChild(title); bar.appendChild(count); bar.appendChild(copy); bar.appendChild(clear);
    box.appendChild(bar); box.appendChild(list);
    document.body.appendChild(box);

    return { box: box, list: list, count: count };
  }

  function selector(el) {
    if (!el || el.nodeType !== 1) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    var cls = typeof el.className === 'string' ? el.className.trim() : '';
    if (cls) s += '.' + cls.split(/\s+/).join('.');
    return s;
  }

  /* --- сеть --- */
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function (input) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url) add(classify(url), shortUrl(url));
      return nativeFetch.apply(this, arguments);
    };
  }

  var nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    add(classify(url), method + ' ' + shortUrl(url));
    return nativeOpen.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    var nativeBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url) {
      add(classify(url), 'beacon ' + shortUrl(url));
      return nativeBeacon.apply(this, arguments);
    };
  }

  /* --- ресурсы: пиксель отправляет цель через new Image(), в DOM такой узел не появляется --- */
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (!/\/pixel\?|goals=|actm\/js\/actm\.js|ak_container\.js|event\/post/.test(e.name)) return;
        var m = /[?&]goals=([^&]*)/.exec(e.name);
        var g = m ? decodeURIComponent(m[1]).replace(/,/g, ', ') : '';
        add(classify(e.name), shortUrl(e.name) + (g ? '  [' + g + ']' : ''));
      });
    }).observe({ type: 'resource', buffered: true });
  } catch (err) {}

  /* --- подгружаемые скрипты, пиксели, фреймы --- */
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (!n.tagName) return;
        var src = n.src || n.getAttribute && n.getAttribute('src');
        if (!src) return;
        if (n.tagName === 'SCRIPT') add(classify(src), 'script ' + shortUrl(src));
        if (n.tagName === 'IMG') add(classify(src), 'img ' + shortUrl(src));
        if (n.tagName === 'IFRAME') add(classify(src), 'iframe ' + shortUrl(src));
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* --- клики --- */
  document.addEventListener('click', function (e) {
    var chain = [];
    var el = e.target;
    for (var i = 0; i < 3 && el && el.nodeType === 1; i++) {
      chain.push(selector(el));
      el = el.parentElement;
    }
    add('click', chain.filter(Boolean).join(' ← '));
  }, true);

  /* --- ошибки --- */
  window.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      add('error', 'не загрузился ' + shortUrl(e.target.src || ''));
      return;
    }
    add('error', (e.message || 'ошибка') + ' · ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    add('error', 'promise: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)).slice(0, 120));
  });

  /* --- переходы без перезагрузки --- */
  ['pushState', 'replaceState'].forEach(function (name) {
    var orig = history[name];
    if (!orig) return;
    history[name] = function () {
      var res = orig.apply(this, arguments);
      add('nav', name + ' → ' + location.pathname + location.search);
      return res;
    };
  });

  /* --- перехват ak_pixel_push: видно, какие цели реально отправляет контейнер --- */
  (function () {
    var orig = window.ak_pixel_push;
    if (typeof orig !== 'function') return;
    window.ak_pixel_push = function (goal, value) {
      add('pixel', 'цель из контейнера: ak_pixel_push("' + goal + '"' +
        (value === undefined ? '' : ', ' + value) + ')');
      try {
        var res = orig.apply(window, arguments);
        if (res && typeof res.then === 'function') {
          res.then(null, function (e) {
            add('error', 'цель ' + goal + ': ' + (e && e.message ? e.message : String(e)));
          });
        }
        return res;
      } catch (e) {
        add('error', 'цель ' + goal + ': ' + (e.message || String(e)));
      }
    };
  })();

  /* --- старт --- */
  function report() {
    add('info', 'страница ' + location.pathname + location.search);
    var container = document.querySelector('script[src*="actm/js/actm.js"]');
    add('info', 'скрипт контейнера: ' + (container ? 'в DOM' : 'НЕ найден'));
    add('info', 'acDataLayer: ' + (window.acDataLayer ? 'есть, событий ' + window.acDataLayer.length : 'нет'));
    add('info', 'acpopup: ' + (typeof window.acpopup === 'function' ? 'есть' : 'нет'));
    add('info', 'ak_pixel_push: ' + (typeof window.ak_pixel_push === 'function' ? 'есть' : 'нет'));
  }

  ui = build();
  paint();
  report();
  window.addEventListener('load', function () {
    setTimeout(report, 1500);
  });
})();
