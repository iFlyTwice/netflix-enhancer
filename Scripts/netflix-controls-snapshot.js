/**
 * Netflix Controls Snapshot — INSTANT capture
 *
 * 1. Move your mouse over the player so controls are visible
 * 2. While still hovering, QUICKLY paste this and press Enter
 *
 * This script is synchronous — no delays, no async, captures in <10ms.
 */

(function() {
    var r = {}, qs = function(s) { return document.querySelector(s); },
        qsa = function(s, root) { return Array.from((root||document).querySelectorAll(s)); };

    // All buttons on the page
    r.allButtons = qsa('button').map(function(b, i) {
        var rect = b.getBoundingClientRect();
        var svg = b.querySelector('svg');
        return {
            i: i,
            label: b.getAttribute('aria-label'),
            uia: b.getAttribute('data-uia') || (b.closest('[data-uia]') || {}).getAttribute && b.closest('[data-uia]') ? b.closest('[data-uia]').getAttribute('data-uia') : null,
            cls: (b.className || '').slice(0, 80),
            x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height),
            vis: rect.width > 0,
            svg: svg ? svg.getAttribute('viewBox') : null,
            parent: (b.parentElement.className || '').slice(0, 60),
            gp: (b.parentElement.parentElement ? b.parentElement.parentElement.className : '').slice(0, 60),
        };
    }).filter(function(b) { return b.vis; });

    // All data-uia elements
    r.dataUia = qsa('[data-uia]').map(function(el) {
        var rect = el.getBoundingClientRect();
        return { uia: el.getAttribute('data-uia'), tag: el.tagName.toLowerCase(), vis: rect.width > 0 };
    }).filter(function(x) { return x.vis; });

    // All role=slider elements (timeline scrubber)
    r.sliders = qsa('[role="slider"]').map(function(el) {
        var rect = el.getBoundingClientRect();
        return {
            label: el.getAttribute('aria-label'),
            uia: el.getAttribute('data-uia'),
            min: el.getAttribute('aria-valuemin'),
            max: el.getAttribute('aria-valuemax'),
            now: el.getAttribute('aria-valuenow'),
            x: Math.round(rect.x), y: Math.round(rect.y),
            w: Math.round(rect.width), h: Math.round(rect.height),
        };
    });

    // Player state
    r.playerState = qs('[data-uia="player"]') ? qs('[data-uia="player"]').className : 'not found';

    // Known container check
    r.containers = [
        '.watch-video--bottom-controls-container',
        '.PlayerControlsNeo__layout',
        '.PlayerControlsNeo__bottom-controls',
        '.PlayerControlsNeo__core-controls',
        '[data-uia="controls-standard"]',
    ].map(function(s) { var el = qs(s); return { sel: s, found: !!el, kids: el ? el.children.length : 0 }; });

    // DOM classes snapshot — every class on the page right now
    var allClasses = new Set();
    qsa('*').forEach(function(el) {
        if (el.className && typeof el.className === 'string') {
            el.className.split(/\s+/).forEach(function(c) { if (c) allClasses.add(c); });
        }
    });
    r.allClasses = Array.from(allClasses).sort();

    console.clear();
    console.log('%c NETFLIX CONTROLS SNAPSHOT', 'color: #e50914; font-size: 16px; font-weight: bold');
    console.log('%cPlayer state: ' + r.playerState, 'color: #a78bfa; font-size: 13px');
    console.log('%cVisible buttons: ' + r.allButtons.length, 'color: #46d369; font-size: 13px');

    console.groupCollapsed('%cVisible Buttons', 'color: #46d369; font-weight: bold');
    console.table(r.allButtons);
    console.groupEnd();

    console.groupCollapsed('%cVisible data-uia', 'color: #46d369; font-weight: bold');
    console.table(r.dataUia);
    console.groupEnd();

    console.groupCollapsed('%cSliders', 'color: #46d369; font-weight: bold');
    console.table(r.sliders);
    console.groupEnd();

    console.groupCollapsed('%cContainers', 'color: #46d369; font-weight: bold');
    console.table(r.containers);
    console.groupEnd();

    console.groupCollapsed('%cAll CSS Classes', 'color: #46d369; font-weight: bold');
    console.log(r.allClasses);
    console.groupEnd();

    window.__snap = r;
    console.log('%c\nStored in window.__snap — run: copy(JSON.stringify(window.__snap, null, 2))', 'color: #888');
    return r;
})();
