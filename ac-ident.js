/* Идентификация посетителя на стенде.
   Пока email неизвестен — цели уходят анонимно, как раньше.
   Как только email введён здесь (или пришёл в адресе страницы ?email=),
   каждый вызов ak_pixel_push автоматически получает match/update/matching_mode/db_id,
   поэтому все действия складываются в один профиль базы 8. */
(function () {
    'use strict';

    var KEY = 'ac-identity';
    var DB = 8;

    function read() {
        try {
            return JSON.parse(window.localStorage.getItem(KEY) || 'null');
        } catch (e) {
            return null;
        }
    }

    function write(value) {
        try {
            if (value) {
                window.localStorage.setItem(KEY, JSON.stringify(value));
            } else {
                window.localStorage.removeItem(KEY);
            }
        } catch (e) {}
    }

    function fieldsFromName(name) {
        var parts = (name || '').trim().split(/\s+/).filter(Boolean);
        var update = {};
        if (parts[0]) update._fname = parts[0];
        if (parts.length > 1) update._lname = parts.slice(1).join(' ');
        return update;
    }

    var params = new URLSearchParams(location.search);
    var fromUrl = (params.get('email') || '').trim();
    if (fromUrl) {
        var existing = read();
        if (!existing || existing.email !== fromUrl) {
            write({ email: fromUrl, name: (params.get('name') || '').trim() });
        }
    }

    /* Оборачиваем отправку целей: подставляем идентификатор, если он известен. */
    function wrap() {
        if (typeof window.ak_pixel_push !== 'function' || window.ak_pixel_push.__acIdent) return false;
        var original = window.ak_pixel_push;

        var wrapper = function (goals, value, match, update, mode, db) {
            var who = read();
            if (who && who.email) {
                match = match || { email: who.email };
                update = update || fieldsFromName(who.name);
                mode = mode || 'email';
                db = db || DB;
            }
            return original.call(window, goals, value, match, update, mode, db);
        };
        wrapper.__acIdent = true;
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

    /* Сообщаем платформе, кто это, чтобы профиль появился сразу после входа. */
    function identify() {
        var who = read();
        if (!who || !who.email || typeof window.ak_pixel_push !== 'function') return;
        try {
            if (window.sessionStorage.getItem('ac-ident-sent') === who.email) return;
            window.sessionStorage.setItem('ac-ident-sent', who.email);
        } catch (e) {}
        window.ak_pixel_push('identify', 0, { email: who.email }, fieldsFromName(who.name), 'email', DB);
    }

    /* Панель входа */
    function render() {
        var who = read();
        var box = document.createElement('div');
        box.id = 'ac-ident';
        box.style.cssText = [
            'position:fixed', 'left:12px', 'bottom:12px', 'z-index:9999',
            'background:#fff', 'border:1px solid #d0d5dd', 'border-radius:10px',
            'box-shadow:0 6px 20px rgba(16,24,40,.12)', 'padding:10px 12px',
            'font:13px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif', 'color:#1d2939',
            'max-width:320px'
        ].join(';');

        var title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:6px';
        title.textContent = 'Профиль для записи событий';
        box.appendChild(title);

        var state = document.createElement('div');
        state.style.cssText = 'margin-bottom:8px;color:#475467';
        state.textContent = who && who.email ? 'вошёл как ' + who.email : 'не выбран — цели уходят анонимно';
        box.appendChild(state);

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px';

        var email = document.createElement('input');
        email.type = 'email';
        email.placeholder = 'email посетителя';
        email.value = who && who.email ? who.email : '';
        email.style.cssText = 'flex:1;min-width:0;padding:6px 8px;border:1px solid #d0d5dd;border-radius:6px;font:inherit';

        var name = document.createElement('input');
        name.type = 'text';
        name.placeholder = 'имя';
        name.value = who && who.name ? who.name : '';
        name.style.cssText = 'width:88px;padding:6px 8px;border:1px solid #d0d5dd;border-radius:6px;font:inherit';

        row.appendChild(email);
        row.appendChild(name);
        box.appendChild(row);

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;margin-top:6px';

        var login = document.createElement('button');
        login.type = 'button';
        login.textContent = 'Войти';
        login.style.cssText = 'padding:6px 10px;border:0;border-radius:6px;background:#175cd3;color:#fff;font:inherit;cursor:pointer';

        var logout = document.createElement('button');
        logout.type = 'button';
        logout.textContent = 'Выйти';
        logout.style.cssText = 'padding:6px 10px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#344054;font:inherit;cursor:pointer';

        actions.appendChild(login);
        actions.appendChild(logout);
        box.appendChild(actions);

        login.addEventListener('click', function () {
            var value = (email.value || '').trim();
            if (!value) {
                email.focus();
                return;
            }
            write({ email: value, name: (name.value || '').trim() });
            if (typeof window.ak_pixel_push === 'function') {
                window.ak_pixel_push('identify', 0, { email: value }, fieldsFromName(name.value), 'email', DB);
            }
            box.remove();
            render();
        });

        logout.addEventListener('click', function () {
            write(null);
            box.remove();
            render();
        });

        document.body.appendChild(box);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
