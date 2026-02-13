/**
 * Netflix Player Controls Mapper
 *
 * Netflix hides player controls when idle. This script:
 *  1. Forces the controls bar to appear (simulates mouse movement)
 *  2. Waits for the DOM to populate
 *  3. Maps every button — tag, selector, position, size, order, icon, parent containers
 *
 * Paste into browser console on a /watch/* page while a video is playing.
 * Move your mouse over the player first if the controls are not appearing.
 *
 * Usage: Netflix /watch page → F12 → Console → Paste & Enter
 */

(async function NetflixControlsMapper() {
    'use strict';

    if (!location.pathname.startsWith('/watch')) {
        console.warn('[Controls Mapper] Not on a /watch page.');
        return;
    }

    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
    function truncate(str, len) { len = len || 120; if (!str) return ''; return str.length > len ? str.slice(0, len) + '…' : str; }

    // ── Step 1: Force controls to appear ─────────────────────────────

    console.log('%c[Controls Mapper] Triggering mouse movement to reveal controls...', 'color: #a78bfa');

    var playerView = qs('[data-uia="watch-video"]') || qs('.watch-video--player-view') || qs('[data-uia="video-canvas"]');
    if (playerView) {
        for (var i = 0; i < 3; i++) {
            playerView.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, clientX: 600 + i * 10, clientY: 500
            }));
            await new Promise(function(r) { setTimeout(r, 200); });
        }
    }

    // Wait for controls to render
    await new Promise(function(r) { setTimeout(r, 1500); });

    var report = {};

    // ── Step 2: Find the controls container ──────────────────────────

    var containerSelectors = [
        '.watch-video--bottom-controls-container',
        '[data-uia="controls-standard"]',
        '.PlayerControlsNeo__layout',
        '.PlayerControlsNeo__bottom-controls',
        '.PlayerControlsNeo__core-controls',
    ];

    report.containers = containerSelectors.map(function(sel) {
        var el = qs(sel);
        if (!el) return { selector: sel, found: false };
        var rect = el.getBoundingClientRect();
        return {
            selector: sel,
            found: true,
            tag: el.tagName.toLowerCase(),
            classes: el.className,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            childCount: el.children.length,
        };
    });

    var foundContainer = containerSelectors.find(function(sel) { return qs(sel); });
    var controlsRoot = qs(foundContainer || 'body');

    // ── Step 3: Map every button in the controls area ────────────────

    var allButtons = qsa('button', controlsRoot);
    report.buttons = allButtons.map(function(btn, index) {
        var rect = btn.getBoundingClientRect();
        var svg = btn.querySelector('svg');
        var img = btn.querySelector('img');
        var closest = btn.closest('[data-uia]');
        var dataUia = btn.getAttribute('data-uia') || (closest ? closest.getAttribute('data-uia') : null);

        return {
            index: index,
            tag: 'button',
            dataUia: dataUia || null,
            ariaLabel: btn.getAttribute('aria-label'),
            title: btn.getAttribute('title'),
            text: truncate(btn.textContent.trim(), 50),
            classes: truncate(btn.className, 80),
            id: btn.id || null,
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                w: Math.round(rect.width),
                h: Math.round(rect.height),
            },
            visible: rect.width > 0 && rect.height > 0,
            hasSvgIcon: !!svg,
            svgViewBox: svg ? svg.getAttribute('viewBox') : null,
            svgSize: svg ? { w: svg.getAttribute('width'), h: svg.getAttribute('height') } : null,
            hasImage: !!img,
            parentClasses: truncate(btn.parentElement ? btn.parentElement.className : '', 80),
            parentDataUia: btn.parentElement ? btn.parentElement.getAttribute('data-uia') : null,
            grandparentClasses: truncate(btn.parentElement && btn.parentElement.parentElement ? btn.parentElement.parentElement.className : '', 80),
        };
    });

    // ── Step 4: Map all interactive elements (not just buttons) ──────

    var interactives = qsa('[role="button"], [role="slider"], [tabindex], a, [data-uia]', controlsRoot);
    report.interactiveElements = interactives
        .filter(function(el) { return el.tagName.toLowerCase() !== 'button'; })
        .map(function(el) {
            var rect = el.getBoundingClientRect();
            return {
                tag: el.tagName.toLowerCase(),
                role: el.getAttribute('role'),
                dataUia: el.getAttribute('data-uia'),
                ariaLabel: el.getAttribute('aria-label'),
                ariaValueNow: el.getAttribute('aria-valuenow'),
                ariaValueMin: el.getAttribute('aria-valuemin'),
                ariaValueMax: el.getAttribute('aria-valuemax'),
                classes: truncate(el.className, 80),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                visible: rect.width > 0 && rect.height > 0,
            };
        })
        .filter(function(el) { return el.visible; });

    // ── Step 5: Full DOM tree walk of controls ───────────────────────

    function walkDOM(el, depth) {
        depth = depth || 0;
        if (depth > 10 || !el) return null;
        var rect = el.getBoundingClientRect();
        var info = {
            tag: el.tagName.toLowerCase(),
            classes: typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : [],
        };
        var dUia = el.getAttribute ? el.getAttribute('data-uia') : null;
        var aLabel = el.getAttribute ? el.getAttribute('aria-label') : null;
        var role = el.getAttribute ? el.getAttribute('role') : null;
        if (dUia) info.dataUia = dUia;
        if (aLabel) info.ariaLabel = aLabel;
        if (role) info.role = role;
        if (rect.width > 0) info.size = { w: Math.round(rect.width), h: Math.round(rect.height) };

        var children = Array.from(el.children);
        if (children.length > 0 && children.length <= 20) {
            info.children = children.map(function(c) { return walkDOM(c, depth + 1); }).filter(Boolean);
        } else if (children.length > 20) {
            info.childCount = children.length;
            info.note = 'Too many children to walk';
        }
        return info;
    }

    if (controlsRoot !== document.body) {
        report.controlsDOMTree = walkDOM(controlsRoot);
    }

    // ── Step 6: Identify button groups / sections ────────────────────

    var groupCandidates = [
        '.PlayerControlsNeo__button-control-row',
        '.PlayerControlsNeo__all-controls',
        '[class*="left-controls"]',
        '[class*="center-controls"]',
        '[class*="right-controls"]',
        '[class*="control-row"]',
        '[class*="button-group"]',
    ];

    report.buttonGroups = [];
    groupCandidates.forEach(function(sel) {
        qsa(sel).forEach(function(el) {
            var rect = el.getBoundingClientRect();
            var buttons = qsa('button', el);
            report.buttonGroups.push({
                selector: sel,
                classes: truncate(el.className, 100),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                buttonCount: buttons.length,
                buttonLabels: buttons.map(function(b) { return b.getAttribute('aria-label') || b.getAttribute('data-uia') || '?'; }),
            });
        });
    });

    // ── Step 7: Specific known control discovery ─────────────────────

    var knownControls = {
        'play-pause':       '[data-uia="control-play-pause"], [aria-label*="Play"], [aria-label*="Pause"]',
        'back-10':          '[data-uia="control-back10"], [aria-label*="Back 10"], [aria-label*="Rewind"]',
        'forward-10':       '[data-uia="control-forward10"], [aria-label*="Forward 10"]',
        'volume':           '[data-uia*="control-volume"], [aria-label*="Volume"], [aria-label*="Mute"]',
        'speed':            '[data-uia="control-speed"], [aria-label*="Speed"], [aria-label*="Playback speed"]',
        'subtitles':        '[data-uia="control-audio-subtitle"], [aria-label*="Audio"], [aria-label*="Subtitle"]',
        'episodes':         '[data-uia="control-episodes"], [aria-label*="Episodes"]',
        'fullscreen':       '[data-uia*="control-fullscreen"], [aria-label*="Full screen"], [aria-label*="Fullscreen"]',
        'next-episode':     '[data-uia="control-next"], [aria-label*="Next episode"], [aria-label*="Next Episode"]',
        'timeline':         '[data-uia="timeline"], [role="slider"][aria-label*="time"], [role="slider"][aria-label*="Seek"]',
        'skip-intro':       '[data-uia="player-skip-intro"]',
        'skip-recap':       '[data-uia="player-skip-recap"]',
        'skip-credits':     '[data-uia="next-episode-seamless-button"]',
    };

    report.knownControls = {};
    Object.keys(knownControls).forEach(function(name) {
        var sel = knownControls[name];
        var el = qs(sel);
        if (!el) {
            report.knownControls[name] = { found: false, selector: sel };
            return;
        }
        var rect = el.getBoundingClientRect();
        report.knownControls[name] = {
            found: true,
            selector: sel,
            matchedSelector: (function() {
                var parts = sel.split(', ');
                for (var j = 0; j < parts.length; j++) {
                    if (qs(parts[j].trim())) return parts[j].trim();
                }
                return sel;
            })(),
            tag: el.tagName.toLowerCase(),
            ariaLabel: el.getAttribute('aria-label'),
            dataUia: el.getAttribute('data-uia'),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            parentClasses: truncate(el.parentElement ? el.parentElement.className : '', 80),
        };
    });

    // ── Step 8: Best injection point for a PiP button ────────────────

    report.pipInjectionAnalysis = {};

    var fullscreenBtn = qs('[data-uia*="control-fullscreen"]') || qs('[aria-label*="Full screen"]') || qs('[aria-label*="Fullscreen"]');
    if (fullscreenBtn) {
        var parent = fullscreenBtn.parentElement;
        var grandparent = parent ? parent.parentElement : null;
        report.pipInjectionAnalysis = {
            strategy: 'Insert PiP button next to fullscreen button',
            fullscreenParent: {
                tag: parent ? parent.tagName.toLowerCase() : null,
                classes: truncate(parent ? parent.className : '', 100),
                dataUia: parent ? parent.getAttribute('data-uia') : null,
                childCount: parent ? parent.children.length : 0,
                childTags: Array.from(parent ? parent.children : []).map(function(c) {
                    return {
                        tag: c.tagName.toLowerCase(),
                        ariaLabel: c.getAttribute('aria-label'),
                        dataUia: c.getAttribute('data-uia'),
                    };
                }),
            },
            grandparent: {
                tag: grandparent ? grandparent.tagName.toLowerCase() : null,
                classes: truncate(grandparent ? grandparent.className : '', 100),
            },
            recommendation: 'Use fullscreenBtn.parentElement.insertBefore(pipBtn, fullscreenBtn) to place PiP left of fullscreen',
        };
    } else {
        var bar = qs('[class*="control-row"]') || qs('[class*="button-control"]') || qs('.PlayerControlsNeo__core-controls');
        report.pipInjectionAnalysis = {
            strategy: 'Fullscreen button not found — append to controls bar',
            controlsBar: bar ? {
                tag: bar.tagName.toLowerCase(),
                classes: truncate(bar.className, 100),
                childCount: bar.children.length,
            } : null,
            recommendation: bar
                ? 'Append PiP button as last child of controls bar'
                : 'Controls not visible — need to inject via MutationObserver when controls appear',
        };
    }

    // ── Step 9: Button size reference ────────────────────────────────

    var visibleButtons = report.buttons.filter(function(b) { return b.visible; });
    if (visibleButtons.length > 0) {
        var widths = visibleButtons.map(function(b) { return b.rect.w; });
        var heights = visibleButtons.map(function(b) { return b.rect.h; });
        report.buttonSizeReference = {
            count: visibleButtons.length,
            avgWidth: Math.round(widths.reduce(function(a, b) { return a + b; }, 0) / widths.length),
            avgHeight: Math.round(heights.reduce(function(a, b) { return a + b; }, 0) / heights.length),
            minWidth: Math.min.apply(null, widths),
            maxWidth: Math.max.apply(null, widths),
            minHeight: Math.min.apply(null, heights),
            maxHeight: Math.max.apply(null, heights),
            sizes: visibleButtons.map(function(b) {
                return {
                    label: b.ariaLabel || b.dataUia || b.text || '?',
                    w: b.rect.w,
                    h: b.rect.h,
                };
            }),
            recommendation: 'Match the most common button size for PiP button to blend in seamlessly',
        };
    } else {
        report.buttonSizeReference = {
            note: 'No visible buttons found — controls may have hidden again. Try re-running while hovering over the player.',
        };
    }

    // ── Step 10: All data-uia on the page (for completeness) ─────────

    report.allDataUia = qsa('[data-uia]').map(function(el) {
        var rect = el.getBoundingClientRect();
        return {
            value: el.getAttribute('data-uia'),
            tag: el.tagName.toLowerCase(),
            visible: rect.width > 0 && rect.height > 0,
        };
    }).filter(function(x) { return x.visible; });

    // ── Output ───────────────────────────────────────────────────────

    console.clear();
    console.log('%c╔══════════════════════════════════════════════════╗', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c║     Netflix Player Controls Mapper               ║', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════════════╝', 'color: #e50914; font-size: 14px; font-weight: bold');

    if (report.buttons.filter(function(b) { return b.visible; }).length === 0) {
        console.log('%c⚠️  No visible buttons found! Move your mouse over the player and re-run this script.', 'color: #fca5a5; font-size: 13px; font-weight: bold');
    }

    var sections = [
        ['1. Control Containers', report.containers],
        ['2. All Buttons (ordered left→right)', report.buttons],
        ['3. Interactive Elements (sliders, links)', report.interactiveElements],
        ['4. Controls DOM Tree', report.controlsDOMTree],
        ['5. Button Groups (left/center/right)', report.buttonGroups],
        ['6. Known Controls Lookup', report.knownControls],
        ['7. PiP Button Injection Analysis', report.pipInjectionAnalysis],
        ['8. Button Size Reference', report.buttonSizeReference],
        ['9. All Visible data-uia Elements', report.allDataUia],
    ];

    sections.forEach(function(entry) {
        var title = entry[0], data = entry[1];
        console.groupCollapsed('%c' + title, 'color: #46d369; font-weight: bold; font-size: 12px');
        try {
            console.log(JSON.parse(JSON.stringify(data, null, 2)));
        } catch(e) {
            console.log(data);
        }
        console.groupEnd();
    });

    console.log('%c\n🎯 PiP Injection Summary:', 'color: #a78bfa; font-weight: bold; font-size: 13px');
    console.table(report.pipInjectionAnalysis);

    if (report.buttonSizeReference.sizes) {
        console.log('%c\n📐 Button Sizes:', 'color: #a78bfa; font-weight: bold; font-size: 13px');
        console.table(report.buttonSizeReference.sizes);
    }

    console.log('%c\n📋 Full report stored in window.__nfxControlsMapper', 'color: #aaa');
    window.__nfxControlsMapper = report;

    try {
        copy(JSON.stringify(report, null, 2));
        console.log('%c📋 Copied to clipboard!', 'color: #46d369');
    } catch(e) {
        console.log('%c(Could not auto-copy — use: copy(JSON.stringify(window.__nfxControlsMapper, null, 2)))', 'color: #888');
    }

    return report;
})();
