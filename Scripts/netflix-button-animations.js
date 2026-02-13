/**
 * Netflix Button Animation Inspector
 * Run while hovering over player controls.
 */
(function() {
    var btns = [
        '[data-uia="control-play-pause-play"], [data-uia="control-play-pause-pause"]',
        '[data-uia="control-back10"]',
        '[data-uia*="control-volume"]',
        '[data-uia="control-audio-subtitle"]',
        '[data-uia="control-speed"]',
        '[data-uia="control-pip"]',
        '[data-uia="control-fullscreen-enter"], [data-uia="control-fullscreen-exit"]',
    ];

    var r = btns.map(function(sel) {
        var el = document.querySelector(sel);
        if (!el) return null;
        var cs = getComputedStyle(el);
        var svg = el.querySelector('svg');
        var svgCs = svg ? getComputedStyle(svg) : null;

        // Also check :hover styles by looking at CSS rules
        var hoverRules = [];
        try {
            Array.from(document.styleSheets).forEach(function(sheet) {
                try {
                    Array.from(sheet.cssRules || []).forEach(function(rule) {
                        if (rule.selectorText && rule.selectorText.includes(':hover') && el.matches(rule.selectorText.replace(/:hover/g, ''))) {
                            hoverRules.push(rule.cssText.slice(0, 200));
                        }
                    });
                } catch(e) {}
            });
        } catch(e) {}

        return {
            btn: el.getAttribute('data-uia'),
            // Transition & animation
            transition: cs.transition,
            transitionProperty: cs.transitionProperty,
            transitionDuration: cs.transitionDuration,
            transitionTimingFunction: cs.transitionTimingFunction,
            animation: cs.animation,
            animationName: cs.animationName,
            // Transform
            transform: cs.transform,
            transformOrigin: cs.transformOrigin,
            // Opacity & visibility
            opacity: cs.opacity,
            visibility: cs.visibility,
            // Cursor
            cursor: cs.cursor,
            // Color & background
            color: cs.color,
            background: cs.background.slice(0, 80),
            // SVG transitions
            svgTransition: svgCs ? svgCs.transition : null,
            svgOpacity: svgCs ? svgCs.opacity : null,
            svgTransform: svgCs ? svgCs.transform : null,
            // Hover rules found
            hoverRules: hoverRules.length > 0 ? hoverRules : 'none found',
        };
    }).filter(Boolean);

    console.clear();
    console.log('%c BUTTON ANIMATION CHECK', 'color: #e50914; font-size: 16px; font-weight: bold');
    console.table(r.map(function(x) {
        return {
            btn: x.btn,
            transition: x.transition,
            transform: x.transform,
            opacity: x.opacity,
            cursor: x.cursor,
            animation: x.animationName,
        };
    }));

    console.log('%c\nFull details:', 'color: #a78bfa; font-weight: bold');
    r.forEach(function(x) {
        console.groupCollapsed('%c' + x.btn, 'color: #46d369');
        console.log(x);
        console.groupEnd();
    });

    window.__btnAnim = r;
    try {
        copy(JSON.stringify(r, null, 2));
        console.log('%c📋 Copied!', 'color: #46d369');
    } catch(e) {
        console.log('run: copy(JSON.stringify(window.__btnAnim, null, 2))');
    }
})();
