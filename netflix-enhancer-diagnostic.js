/**
 * Netflix Enhancer Diagnostic
 *
 * Paste into browser console on Netflix to diagnose exactly why
 * features aren't working. Reports everything the enhancer touches.
 *
 * Usage: Netflix page → F12 → Console → Paste & Enter
 * Then copy the output and share it.
 */

(function NetflixEnhancerDiagnostic() {
    'use strict';

    const R = {}; // report

    function safe(fn) { try { return fn(); } catch (e) { return `ERROR: ${e.message}`; } }
    function qs(sel) { return document.querySelector(sel); }
    function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
    function safeJSON(str) { try { return JSON.parse(decodeURIComponent(str)); } catch { return null; } }

    // ═══════════════════════════════════════════════════════════════
    // 1. ENHANCER LOAD STATUS
    // ═══════════════════════════════════════════════════════════════

    R.enhancerStatus = {
        coreVersion: safe(() => window.__NETFLIX_ENHANCER_CORE_VERSION || 'NOT SET'),
        coreSource: safe(() => window.__NETFLIX_ENHANCER_CORE_SOURCE || 'NOT SET'),
        gmAvailable: typeof GM_info !== 'undefined',
        gmInfo: safe(() => ({
            scriptName: GM_info?.script?.name,
            scriptVersion: GM_info?.script?.version,
            scriptHandler: GM_info?.scriptHandler,
            scriptHandlerVersion: GM_info?.version
        })),
        reactLoaded: typeof window.React !== 'undefined',
        reactVersion: safe(() => window.React?.version),
        reactDomLoaded: typeof window.ReactDOM !== 'undefined',
    };

    // ═══════════════════════════════════════════════════════════════
    // 2. ENHANCER CONFIG (what's enabled/disabled)
    // ═══════════════════════════════════════════════════════════════

    R.config = safe(() => {
        // Try to read GM stored config
        if (typeof GM_getValue === 'function') {
            const raw = GM_getValue('netflixEnhancerConfig', null);
            if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
        return 'GM_getValue not accessible from console (normal — check enhancer logs instead)';
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. TITLE CARD DETECTION
    // ═══════════════════════════════════════════════════════════════

    const titleCardContainers = qsa('.title-card-container');
    const titleCards = qsa('.title-card');
    const ptrackAll = qsa('.ptrack-content');
    const ptrackInBillboard = qsa('.billboard .ptrack-content, .billboard-row .ptrack-content');
    const ptrackInRows = qsa('.lolomoRow .ptrack-content');

    R.titleCardDetection = {
        '.title-card-container': titleCardContainers.length,
        '.title-card': titleCards.length,
        '.ptrack-content (total)': ptrackAll.length,
        '.ptrack-content (in billboard)': ptrackInBillboard.length,
        '.ptrack-content (in rows)': ptrackInRows.length,
        '.slider-refocus links': qsa('a.slider-refocus').length,
        '.boxart-container': qsa('.boxart-container').length,
    };

    // ═══════════════════════════════════════════════════════════════
    // 4. ENHANCER INJECTED ELEMENTS (are our elements in the DOM?)
    // ═══════════════════════════════════════════════════════════════

    R.injectedElements = {
        'cards with [data-ne-enhanced]': qsa('[data-ne-enhanced]').length,
        'cards with [data-enhanced]': qsa('[data-enhanced]').length,
        '.ne-watchlist-btn': qsa('.ne-watchlist-btn').length,
        '.ne-progress-badge': qsa('.ne-progress-badge').length,
        '.ne-progress-bar (old)': qsa('.ne-progress-bar').length,
        '.ne-progress-fill (old)': qsa('.ne-progress-fill').length,
    };

    // ═══════════════════════════════════════════════════════════════
    // 5. PER-CARD DIAGNOSIS (first 8 cards)
    // ═══════════════════════════════════════════════════════════════

    R.cardDetails = titleCardContainers.slice(0, 8).map((card, i) => {
        const link = card.querySelector('a.slider-refocus');
        const boxart = card.querySelector('.boxart-container');
        const ptrack = card.querySelector('.ptrack-content[data-ui-tracking-context]');
        const progressCompleted = card.querySelector('.progress-completed');
        const neEnhanced = card.dataset.neEnhanced;
        const neBadge = card.querySelector('.ne-progress-badge');
        const neWatchlistBtn = card.querySelector('.ne-watchlist-btn');

        // Parse tracking context
        let videoId = null;
        let trackingCtx = null;
        if (ptrack) {
            trackingCtx = safeJSON(ptrack.getAttribute('data-ui-tracking-context'));
            if (trackingCtx) videoId = trackingCtx.video_id;
        }

        // Fallback video ID from URL
        let urlVideoId = null;
        if (link) {
            const match = link.getAttribute('href')?.match(/\/(?:watch|title)\/(\d+)/);
            urlVideoId = match ? match[1] : null;
        }

        // Native progress
        const nativeProgressWidth = progressCompleted ? progressCompleted.style.width : null;

        // Falcor progress data
        let falcorProgress = null;
        const vid = videoId || urlVideoId;
        if (vid && window.netflix?.falcorCache?.videos?.[vid]) {
            const v = window.netflix.falcorCache.videos[vid];
            falcorProgress = {
                bookmarkPosition: v?.bookmarkPosition?.value ?? 'missing',
                runtime: v?.runtime?.value ?? 'missing',
                title: v?.title?.value ?? v?.summary?.value?.title ?? 'missing',
            };
        }

        // Row context
        const row = card.closest('.lolomoRow');
        const rowContext = row ? row.getAttribute('data-list-context') : null;
        const rowHeader = row ? row.querySelector('.row-header-title')?.textContent?.trim() : null;

        return {
            index: i,
            title: link ? link.getAttribute('aria-label') : 'NO LINK FOUND',
            rowHeader,
            rowContext,
            videoId: videoId || 'NOT IN TRACKING CTX',
            urlVideoId: urlVideoId || 'NOT IN URL',
            hasBoxart: !!boxart,
            hasPtrackContext: !!ptrack,
            hasSliderRefocusLink: !!link,
            nativeProgressWidth,
            falcorProgress,
            neEnhanced: neEnhanced || 'NOT SET',
            hasNeBadge: !!neBadge,
            neBadgeText: neBadge ? neBadge.textContent : null,
            neBadgeVisible: neBadge ? getComputedStyle(neBadge).opacity !== '0' && getComputedStyle(neBadge).display !== 'none' : false,
            hasNeWatchlistBtn: !!neWatchlistBtn,
            neWatchlistBtnVisible: neWatchlistBtn ? getComputedStyle(neWatchlistBtn).display !== 'none' : false,
            boxartPosition: boxart ? getComputedStyle(boxart).position : null,
        };
    });

    // ═══════════════════════════════════════════════════════════════
    // 6. NETFLIX APP STATE
    // ═══════════════════════════════════════════════════════════════

    R.netflixState = {
        'window.netflix exists': typeof window.netflix !== 'undefined',
        'window.netflix keys': safe(() => Object.keys(window.netflix || {})),
        'falcorCache exists': safe(() => !!window.netflix?.falcorCache),
        'falcorCache.videos exists': safe(() => !!window.netflix?.falcorCache?.videos),
        'falcorCache.videos count': safe(() => Object.keys(window.netflix?.falcorCache?.videos || {}).length),
        'reactContext exists': safe(() => !!window.netflix?.reactContext),
        'player exists': safe(() => !!window.netflix?.player),
        'appContext exists': safe(() => !!window.netflix?.appContext),
    };

    // Sample a few video entries from falcorCache
    R.falcorVideoSample = safe(() => {
        const videos = window.netflix?.falcorCache?.videos;
        if (!videos) return 'NO falcorCache.videos';
        const keys = Object.keys(videos).slice(0, 3);
        return keys.map(id => {
            const v = videos[id];
            return {
                id,
                hasTitle: !!v?.title?.value,
                title: v?.title?.value || v?.summary?.value?.title || 'NOT FOUND',
                hasBookmark: v?.bookmarkPosition?.value !== undefined,
                bookmarkPosition: v?.bookmarkPosition?.value ?? 'MISSING',
                hasRuntime: v?.runtime?.value !== undefined,
                runtime: v?.runtime?.value ?? 'MISSING',
                availableKeys: Object.keys(v || {}).slice(0, 15),
            };
        });
    });

    // ═══════════════════════════════════════════════════════════════
    // 7. NATIVE PROGRESS BARS
    // ═══════════════════════════════════════════════════════════════

    const nativeBars = qsa('.progress');
    R.nativeProgressBars = {
        count: nativeBars.length,
        details: nativeBars.map(bar => {
            const completed = bar.querySelector('.progress-completed');
            const container = bar.closest('.title-card-container');
            const link = container?.querySelector('a.slider-refocus');
            return {
                title: link?.getAttribute('aria-label') || 'UNKNOWN',
                width: completed?.style.width || 'NO WIDTH',
                insideTitleCardContainer: !!container,
                barParentClass: bar.parentElement?.className?.split(/\s+/)?.[0] || 'UNKNOWN',
            };
        })
    };

    // ═══════════════════════════════════════════════════════════════
    // 8. CSS RULES CHECK (are our styles injected?)
    // ═══════════════════════════════════════════════════════════════

    R.cssCheck = safe(() => {
        const sheets = Array.from(document.styleSheets);
        let neRulesFound = [];
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                    const sel = rule.selectorText || '';
                    if (sel.includes('ne-progress-badge') || sel.includes('ne-watchlist-btn') || sel.includes('title-card-container:hover')) {
                        neRulesFound.push(sel);
                    }
                }
            } catch { /* cross-origin sheet, skip */ }
        }
        return {
            enhancerCSSRulesFound: neRulesFound.length,
            rules: neRulesFound
        };
    });

    // ═══════════════════════════════════════════════════════════════
    // 9. FONT AWESOME CHECK
    // ═══════════════════════════════════════════════════════════════

    R.fontAwesome = {
        faStylesheetsLoaded: qsa('link[href*="font-awesome"], link[href*="fontawesome"], style').length > 0,
        faPlusIconTest: safe(() => {
            const test = document.createElement('i');
            test.className = 'fa-solid fa-plus';
            document.body.appendChild(test);
            const content = getComputedStyle(test, '::before').content;
            document.body.removeChild(test);
            return content !== 'none' && content !== '' ? 'WORKING' : 'BROKEN (icons wont render)';
        })
    };

    // ═══════════════════════════════════════════════════════════════
    // 10. CONSOLE ERRORS
    // ═══════════════════════════════════════════════════════════════

    R.recentErrors = safe(() => {
        // Can't read past console errors, but check for common issues
        const issues = [];

        // Check if MutationObserver would work
        if (typeof MutationObserver === 'undefined') issues.push('MutationObserver not available');

        // Check if body exists
        if (!document.body) issues.push('document.body is null');

        // Check for Content Security Policy blocking inline styles
        const testStyle = document.createElement('style');
        testStyle.textContent = '.ne-diagnostic-test { color: red; }';
        document.head.appendChild(testStyle);
        const testEl = document.createElement('div');
        testEl.className = 'ne-diagnostic-test';
        document.body.appendChild(testEl);
        const styleWorks = getComputedStyle(testEl).color === 'rgb(255, 0, 0)';
        document.head.removeChild(testStyle);
        document.body.removeChild(testEl);
        if (!styleWorks) issues.push('CSP may be blocking injected styles');

        if (issues.length === 0) issues.push('No common issues detected');
        return issues;
    });

    // ═══════════════════════════════════════════════════════════════
    // 11. PAGE STATE
    // ═══════════════════════════════════════════════════════════════

    R.pageState = {
        url: location.href,
        pathname: location.pathname,
        pageType: location.pathname.startsWith('/watch') ? 'WATCH' :
                  location.pathname.startsWith('/title') ? 'TITLE' :
                  location.pathname.startsWith('/browse') ? 'BROWSE' :
                  location.pathname === '/' ? 'HOME' : 'OTHER',
        videoElement: !!qs('video'),
        lolomoRows: qsa('.lolomoRow').length,
        billboardExists: !!qs('.billboard'),
        timestamp: new Date().toISOString(),
    };

    // ═══════════════════════════════════════════════════════════════
    // 12. WATCHLIST STATE
    // ═══════════════════════════════════════════════════════════════

    R.watchlist = safe(() => {
        const wl = window.netflixEnhancerWatchlist;
        if (!wl) return 'window.netflixEnhancerWatchlist NOT FOUND (enhancer may not have initialized)';
        return {
            exists: true,
            itemCount: typeof wl.getWatchlist === 'function' ? wl.getWatchlist()?.length : 'getWatchlist() not available',
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(wl)).filter(m => m !== 'constructor'),
        };
    });

    // ═══════════════════════════════════════════════════════════════
    // 13. MutationObserver TEST
    // ═══════════════════════════════════════════════════════════════

    R.mutationObserverTest = safe(() => {
        let fired = false;
        const obs = new MutationObserver(() => { fired = true; });
        obs.observe(document.body, { childList: true });
        const testDiv = document.createElement('div');
        testDiv.className = 'ne-mo-test';
        document.body.appendChild(testDiv);
        document.body.removeChild(testDiv);
        obs.disconnect();
        // MutationObserver is async, so check synchronously won't work.
        // But if it didn't throw, it's functional.
        return 'MutationObserver is functional (created, observed, disconnected without error)';
    });

    // ═══════════════════════════════════════════════════════════════
    // OUTPUT
    // ═══════════════════════════════════════════════════════════════

    console.clear();
    console.log('%c╔═══════════════════════════════════════════════╗', 'color: #7c3aed; font-size: 14px; font-weight: bold');
    console.log('%c║   Netflix Enhancer Diagnostic Report          ║', 'color: #7c3aed; font-size: 14px; font-weight: bold');
    console.log('%c╚═══════════════════════════════════════════════╝', 'color: #7c3aed; font-size: 14px; font-weight: bold');

    const sections = [
        ['1. Enhancer Load Status', R.enhancerStatus],
        ['2. Config', R.config],
        ['3. Title Card Detection', R.titleCardDetection],
        ['4. Injected Elements (our stuff in DOM)', R.injectedElements],
        ['5. Per-Card Diagnosis (first 8)', R.cardDetails],
        ['6. Netflix App State', R.netflixState],
        ['7. Falcor Video Sample', R.falcorVideoSample],
        ['8. Native Progress Bars', R.nativeProgressBars],
        ['9. CSS Rules Check', R.cssCheck],
        ['10. Font Awesome', R.fontAwesome],
        ['11. Common Issues', R.recentErrors],
        ['12. Page State', R.pageState],
        ['13. Watchlist', R.watchlist],
        ['14. MutationObserver', R.mutationObserverTest],
    ];

    // Print summary at top
    const ok = '✅';
    const fail = '❌';
    const warn = '⚠️';

    console.log('\n%cQuick Summary:', 'font-weight: bold; font-size: 13px; color: white');
    console.log(`  Core loaded:      ${R.enhancerStatus.coreVersion !== 'NOT SET' ? ok : fail} ${R.enhancerStatus.coreVersion}`);
    console.log(`  React:            ${R.enhancerStatus.reactLoaded ? ok : fail} ${R.enhancerStatus.reactVersion || 'missing'}`);
    console.log(`  Cards found:      ${R.titleCardDetection['.title-card-container'] > 0 ? ok : fail} ${R.titleCardDetection['.title-card-container']} cards`);
    console.log(`  Cards enhanced:   ${R.injectedElements['cards with [data-ne-enhanced]'] > 0 ? ok : fail} ${R.injectedElements['cards with [data-ne-enhanced]']} of ${R.titleCardDetection['.title-card-container']}`);
    console.log(`  Watchlist btns:   ${R.injectedElements['.ne-watchlist-btn'] > 0 ? ok : fail} ${R.injectedElements['.ne-watchlist-btn']} buttons`);
    console.log(`  Progress badges:  ${R.injectedElements['.ne-progress-badge'] > 0 ? ok : warn} ${R.injectedElements['.ne-progress-badge']} badges`);
    console.log(`  Native progress:  ${R.nativeProgressBars.count} bars (Netflix's own)`);
    console.log(`  CSS injected:     ${R.cssCheck?.enhancerCSSRulesFound > 0 ? ok : fail} ${R.cssCheck?.enhancerCSSRulesFound || 0} rules`);
    console.log(`  Font Awesome:     ${R.fontAwesome.faPlusIconTest === 'WORKING' ? ok : fail} ${R.fontAwesome.faPlusIconTest}`);
    console.log(`  Falcor videos:    ${R.netflixState['falcorCache.videos count']}`);
    console.log('');

    sections.forEach(([title, data]) => {
        console.groupCollapsed(`%c${title}`, 'color: #46d369; font-weight: bold; font-size: 12px');
        console.log(JSON.parse(JSON.stringify(data, null, 2)));
        console.groupEnd();
    });

    window.__nfxDiag = R;
    console.log('%c\n📋 Full report stored in window.__nfxDiag', 'color: #aaa');
    console.log('%cRun: copy(JSON.stringify(window.__nfxDiag, null, 2)) to copy', 'color: #aaa');

    try { copy(JSON.stringify(R, null, 2)); console.log('%c📋 Copied to clipboard!', 'color: #46d369'); } catch {}

    return R;
})();
