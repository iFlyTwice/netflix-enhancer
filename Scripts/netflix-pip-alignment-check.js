/**
 * PiP Button Alignment Check
 *
 * Compares the PiP button against all other Netflix control buttons
 * to find alignment/sizing differences.
 *
 * Run while hovering over player controls.
 */
(function() {
    var btns = [
        '[data-uia="control-play-pause-play"], [data-uia="control-play-pause-pause"]',
        '[data-uia="control-back10"]',
        '[data-uia="control-forward10"]',
        '[data-uia*="control-volume"]',
        '[data-uia="control-audio-subtitle"]',
        '[data-uia="control-speed"]',
        '[data-uia="control-pip"]',
        '[data-uia="control-fullscreen-enter"], [data-uia="control-fullscreen-exit"]',
    ];

    var rows = btns.map(function(sel) {
        var el = document.querySelector(sel);
        if (!el) return { sel: sel, found: false };
        var rect = el.getBoundingClientRect();
        var cs = getComputedStyle(el);
        var svg = el.querySelector('svg');
        var svgRect = svg ? svg.getBoundingClientRect() : null;
        var svgCs = svg ? getComputedStyle(svg) : null;

        return {
            sel: el.getAttribute('data-uia'),
            label: el.getAttribute('aria-label'),
            // Button box
            bx: Math.round(rect.x),
            by: Math.round(rect.y),
            bw: Math.round(rect.width),
            bh: Math.round(rect.height),
            // Button computed styles
            display: cs.display,
            alignItems: cs.alignItems,
            justifyContent: cs.justifyContent,
            padding: cs.padding,
            margin: cs.margin,
            border: cs.border,
            boxSizing: cs.boxSizing,
            lineHeight: cs.lineHeight,
            verticalAlign: cs.verticalAlign,
            position: cs.position,
            overflow: cs.overflow,
            // SVG inside
            svgFound: !!svg,
            svgW: svgRect ? Math.round(svgRect.width) : null,
            svgH: svgRect ? Math.round(svgRect.height) : null,
            svgX: svgRect ? Math.round(svgRect.x) : null,
            svgY: svgRect ? Math.round(svgRect.y) : null,
            svgViewBox: svg ? svg.getAttribute('viewBox') : null,
            svgWidthAttr: svg ? svg.getAttribute('width') : null,
            svgHeightAttr: svg ? svg.getAttribute('height') : null,
            svgDisplay: svgCs ? svgCs.display : null,
            svgFill: svgCs ? svgCs.fill : null,
            svgStroke: svgCs ? svgCs.stroke : null,
            svgStrokeWidth: svgCs ? svgCs.strokeWidth : null,
            // Class comparison
            className: (el.className || '').slice(0, 100),
            childCount: el.children.length,
            innerHTML: el.innerHTML.length,
        };
    }).filter(function(r) { return r.found !== false; });

    console.clear();
    console.log('%c PiP ALIGNMENT CHECK', 'color: #e50914; font-size: 16px; font-weight: bold');

    // Focus on the key differences
    console.log('%c\nButton Positions & Sizes:', 'color: #a78bfa; font-weight: bold');
    console.table(rows.map(function(r) {
        return { button: r.sel || r.label, x: r.bx, y: r.by, w: r.bw, h: r.bh, padding: r.padding, margin: r.margin, display: r.display, alignItems: r.alignItems };
    }));

    console.log('%c\nSVG Icon Comparison:', 'color: #a78bfa; font-weight: bold');
    console.table(rows.map(function(r) {
        return { button: r.sel || r.label, svgW: r.svgW, svgH: r.svgH, svgX: r.svgX, svgY: r.svgY, viewBox: r.svgViewBox, widthAttr: r.svgWidthAttr, heightAttr: r.svgHeightAttr, svgDisplay: r.svgDisplay, svgStroke: r.svgStroke, svgFill: r.svgFill, svgStrokeWidth: r.svgStrokeWidth };
    }));

    console.log('%c\nClass & Structure:', 'color: #a78bfa; font-weight: bold');
    console.table(rows.map(function(r) {
        return { button: r.sel || r.label, className: r.className, childCount: r.childCount, innerHTMLLen: r.innerHTML };
    }));

    // Highlight the PiP row specifically
    var diffs = {};
    var pip = rows.find(function(r) { return r.sel === 'control-pip'; });
    var ref = rows.find(function(r) { return r.sel === 'control-speed'; });
    if (pip && ref) {
        console.log('%c\n🔍 PiP vs Speed (reference) diff:', 'color: #fca5a5; font-weight: bold; font-size: 13px');
        Object.keys(pip).forEach(function(k) {
            if (pip[k] !== ref[k] && k !== 'sel' && k !== 'label' && k !== 'bx' && k !== 'svgX') {
                diffs[k] = { pip: pip[k], speed: ref[k] };
            }
        });
        console.table(diffs);
    }

    window.__pipCheck = { buttons: rows, diffs: typeof diffs !== 'undefined' ? diffs : null };
    try {
        copy(JSON.stringify(window.__pipCheck, null, 2));
        console.log('%c\n📋 Copied to clipboard!', 'color: #46d369');
    } catch(e) {
        console.log('%c\nStored in window.__pipCheck — run: copy(JSON.stringify(window.__pipCheck, null, 2))', 'color: #888');
    }
})();
