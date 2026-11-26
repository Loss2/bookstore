/* Стенд BookVerse для проверки Менеджера тегов Altcraft.
 *
 * Данные посетителя живут там же, где на обычном сайте: в cookie.
 * Это нужно, чтобы проверить переменные типа «Собственный файл cookie»,
 * «Переменная уровня данных» и «Элемент DOM» — каждая берёт значение
 * из своего источника, а не из адреса страницы.
 *
 * Cookie, которые выставляет стенд:
 *   bv_email        email вошедшего посетителя      (auth.html)
 *   bv_name         имя                              (auth.html)
 *   bv_city         город доставки                   (auth.html)
 *   bv_order_total  сумма последнего заказа          (checkout.html)
 *   bv_order_id     номер последнего заказа          (checkout.html)
 *
 * Слой данных (window.acDataLayer): user_login, add_to_cart, checkout_start.
 */
(function (window, document) {
    'use strict';

    var COOKIE = {
        email: 'bv_email',
        name: 'bv_name',
        city: 'bv_city',
        orderTotal: 'bv_order_total',
        orderId: 'bv_order_id'
    };
    var DB = 8;
    var CART_KEY = 'bv-cart';
    var IDENT_KEY = 'ac-identity';
    var DAY = 864e5;

    /* ---------- cookie ---------- */

    function setCookie(name, value, days) {
        var expires = '';
        if (days) {
            var d = new Date();
            d.setTime(d.getTime() + days * DAY);
            expires = '; expires=' + d.toUTCString();
        }
        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
    }

    function getCookie(name) {
        var parts = document.cookie ? document.cookie.split('; ') : [];
        for (var i = 0; i < parts.length; i++) {
            var eq = parts[i].indexOf('=');
            if (eq > 0 && parts[i].slice(0, eq) === name) {
                var raw = parts[i].slice(eq + 1);
                try { return decodeURIComponent(raw); } catch (e) { return raw; }
            }
        }
        return '';
    }

    function delCookie(name) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }

    function allCookies() {
        var out = {};
        var parts = document.cookie ? document.cookie.split('; ') : [];
        for (var i = 0; i < parts.length; i++) {
            var eq = parts[i].indexOf('=');
            if (eq > 0) {
                var k = parts[i].slice(0, eq);
                var v = parts[i].slice(eq + 1);
                try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; }
            }
        }
        return out;
    }

    /* ---------- профиль ---------- */

    function profile() {
        var email = getCookie(COOKIE.email);
        if (!email) {
            try {
                var ls = JSON.parse(window.localStorage.getItem(IDENT_KEY) || 'null');
                if (ls && ls.email) email = ls.email;
            } catch (e) {}
        }
        return {
            email: email,
            name: getCookie(COOKIE.name),
            city: getCookie(COOKIE.city)
        };
    }

    function fieldsFromName(name) {
        var parts = (name || '').trim().split(/\s+/).filter(Boolean);
        var update = {};
        if (parts[0]) update._fname = parts[0];
        if (parts.length > 1) update._lname = parts.slice(1).join(' ');
        return update;
    }

    function pushLayer(payload) {
        window.acDataLayer = window.acDataLayer || [];
        window.acDataLayer.push(payload);
    }

    function login(email, name, city) {
        setCookie(COOKIE.email, email, 30);
        setCookie(COOKIE.name, name || '', 30);
        setCookie(COOKIE.city, city || '', 30);
        try {
            window.localStorage.setItem(IDENT_KEY, JSON.stringify({ email: email, name: name || '' }));
            window.sessionStorage.removeItem('ac-ident-sent');
        } catch (e) {}
        pushLayer({
            event: 'user_login',
            user_email: email,
            user_name: name || '',
            user_city: city || ''
        });
        identify();
    }

    function logout() {
        delCookie(COOKIE.email);
        delCookie(COOKIE.name);
        delCookie(COOKIE.city);
        try {
            window.localStorage.removeItem(IDENT_KEY);
            window.sessionStorage.removeItem('ac-ident-sent');
        } catch (e) {}
    }

    /* ---------- корзина и заказ ---------- */

    function cart() {
        try {
            return JSON.parse(window.localStorage.getItem(CART_KEY) || 'null') || { items: [], total: 0 };
        } catch (e) {
            return { items: [], total: 0 };
        }
    }

    function saveCart(value) {
        try { window.localStorage.setItem(CART_KEY, JSON.stringify(value)); } catch (e) {}
    }

    function addToCart(item) {
        var current = cart();
        current.items.push(item);
        current.total += Number(item.price) || 0;
        saveCart(current);
        pushLayer({
            event: 'add_to_cart',
            item_id: item.id,
            item_name: item.name,
            value: Number(item.price) || 0
        });
        return current;
    }

    function clearCart() {
        saveCart({ items: [], total: 0 });
    }

    function lastOrder() {
        return { total: getCookie(COOKIE.orderTotal), id: getCookie(COOKIE.orderId) };
    }

    function saveOrder(total, id) {
        setCookie(COOKIE.orderTotal, String(total), 3);
        setCookie(COOKIE.orderId, String(id), 3);
    }

    /* ---------- идентификация для пикселя ---------- */

    /* На каждой странице отдаём контейнеру данные вошедшего посетителя:
       так переменная уровня данных получает значение не только в момент входа. */
    function announce() {
        var who = profile();
        if (!who.email) return;
        var events = window.acDataLayer || [];
        for (var i = 0; i < events.length; i++) {
            if (events[i] && events[i].event === 'user_data' && events[i].user_email === who.email) return;
        }
        pushLayer({
            event: 'user_data',
            user_email: who.email,
            user_name: who.name || '',
            user_city: who.city || ''
        });
    }

    function identify() {
        var who = profile();
        if (!who.email || typeof window.ak_pixel_push !== 'function') return;
        try {
            if (window.sessionStorage.getItem('ac-ident-sent') === who.email) return;
            window.sessionStorage.setItem('ac-ident-sent', who.email);
        } catch (e) {}
        window.ak_pixel_push('identify', 0, { email: who.email }, fieldsFromName(who.name), 'email', DB);

        /* Тот же идентификатор отдаём веб-слою: он привязывает сессию посетителя
           к профилю, и дальше события пикселя находят профиль по сессии. */
        pushLayer({
            matching: {
                matching_mode: 'email',
                matching: { email: who.email, db_id: DB }
            }
        });
    }

    /* Подставляем идентификатор во все цели, чтобы действия складывались в один профиль. */
    function wrap() {
        if (typeof window.ak_pixel_push !== 'function' || window.ak_pixel_push.__acIdent) return false;
        var original = window.ak_pixel_push;

        var wrapper = function (goals, value, match, update, mode, db) {
            var who = profile();
            if (who.email) {
                match = match || { email: who.email };
                update = update || fieldsFromName(who.name);
                mode = mode || 'email';
                db = db || DB;
            }
            return original.call(window, goals, value, match, update, mode, db);
        };
        wrapper.__acIdent = true;
        /* Флаг журнала: иначе он обернёт нашу обёртку ещё раз и запишет цель дважды. */
        wrapper.__tmWrapped = true;
        window.ak_pixel_push = wrapper;
        return true;
    }

    var tries = 0;
    var timer = window.setInterval(function () {
        if (wrap()) {
            window.clearInterval(timer);
            identify();
        } else if (++tries > 40) {
            window.clearInterval(timer);
        }
    }, 250);

    /* ---------- панель на странице ---------- */

    function panel() {
        if (document.getElementById('bv-panel') || !document.body) return;
        var who = profile();
        var box = document.createElement('div');
        box.id = 'bv-panel';
        box.style.cssText = [
            'position:fixed', 'left:12px', 'bottom:12px', 'z-index:9999',
            'background:#fff', 'border:1px solid #d0d5dd', 'border-radius:10px',
            'box-shadow:0 6px 20px rgba(16,24,40,.12)', 'padding:10px 12px',
            'font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif', 'color:#1d2939',
            'max-width:330px'
        ].join(';');

        var title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:4px';
        title.textContent = 'Посетитель';
        box.appendChild(title);

        var state = document.createElement('div');
        state.style.cssText = 'color:#475467;margin-bottom:8px';
        state.textContent = who.email
            ? who.email + (who.city ? ' · ' + who.city : '')
            : 'анонимный — cookie bv_email не выставлена';
        box.appendChild(state);

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';

        function link(text, href, primary) {
            var a = document.createElement('a');
            a.textContent = text;
            a.href = href;
            a.style.cssText = 'padding:6px 10px;border-radius:6px;text-decoration:none;font:inherit;' +
                (primary ? 'background:#175cd3;color:#fff' : 'border:1px solid #d0d5dd;color:#344054;background:#fff');
            return a;
        }

        var base = /\/product\//.test(location.pathname) ? '../' : '';
        row.appendChild(link(who.email ? 'Профиль' : 'Войти', base + (who.email ? 'account.html' : 'auth.html'), !who.email));
        row.appendChild(link('Проверка', base + 'verify.html', false));
        box.appendChild(row);
        document.body.appendChild(box);
    }

    function boot() {
        panel();
        announce();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    window.BV = {
        cookies: allCookies,
        getCookie: getCookie,
        setCookie: setCookie,
        delCookie: delCookie,
        COOKIE: COOKIE,
        profile: profile,
        login: login,
        logout: logout,
        cart: cart,
        addToCart: addToCart,
        clearCart: clearCart,
        lastOrder: lastOrder,
        saveOrder: saveOrder,
        pushLayer: pushLayer,
        identify: identify,
        announce: announce
    };
})(window, document);
