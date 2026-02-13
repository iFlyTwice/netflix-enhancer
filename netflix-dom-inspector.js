/**
 * Netflix DOM Inspector
 *
 * Paste this into the browser console on any Netflix page (home, browse, watch, title)
 * to get a full report of the DOM structure, selectors, data attributes, and APIs
 * that the Netflix Enhancer can hook into.
 *
 * Usage: Open Netflix → F12 → Console → Paste & Enter
 */

(function NetflixDOMInspector() {
    'use strict';

    const report = {};

    // ── Helpers ──────────────────────────────────────────────────────

    function unique(arr) {
        return [...new Set(arr)];
    }

    function truncate(str, len = 120) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

    function safeJSON(str) {
        try { return JSON.parse(decodeURIComponent(str)); } catch { return null; }
    }

    function collectSelectors(root, selector) {
        return Array.from(root.querySelectorAll(selector));
    }

    // ── 1. Page Context ─────────────────────────────────────────────

    report.page = {
        url: location.href,
        pathname: location.pathname,
        type: location.pathname.startsWith('/watch') ? 'watch' :
              location.pathname.startsWith('/title') ? 'title' :
              location.pathname.startsWith('/browse') ? 'browse' :
              location.pathname === '/' ? 'home' : 'other',
        timestamp: new Date().toISOString()
    };

    // ── 2. Row Structure (lolomoRows) ───────────────────────────────

    const rows = collectSelectors(document, '.lolomoRow');
    report.rows = {
        count: rows.length,
        details: rows.map((row, i) => {
            const listContext = row.getAttribute('data-list-context');
            const headerEl = row.querySelector('.row-header-title');
            const headerText = headerEl ? headerEl.textContent.trim() : null;
            const sliderItems = row.querySelectorAll('.slider-item');
            const titleCards = row.querySelectorAll('.title-card');
            const ptrackInRow = row.querySelectorAll('.ptrack-content');

            return {
                index: i,
                listContext,
                headerText,
                sliderItemCount: sliderItems.length,
                titleCardCount: titleCards.length,
                ptrackContentCount: ptrackInRow.length,
                classes: row.className
            };
        })
    };

    // ── 3. Title Card Anatomy ───────────────────────────────────────

    const firstCard = document.querySelector('.title-card-container');
    if (firstCard) {
        const walkTree = (el, depth = 0) => {
            if (depth > 8) return null;
            const info = {
                tag: el.tagName.toLowerCase(),
                classes: el.className && typeof el.className === 'string'
                    ? el.className.split(/\s+/).filter(Boolean) : [],
                id: el.id || undefined,
                dataAttrs: {},
                attrs: {}
            };

            // Collect data-* attributes
            for (const attr of el.attributes) {
                if (attr.name.startsWith('data-')) {
                    info.dataAttrs[attr.name] = truncate(attr.value, 80);
                } else if (['role', 'aria-label', 'href', 'src', 'tabindex', 'style'].includes(attr.name)) {
                    info.attrs[attr.name] = truncate(attr.value, 80);
                }
            }

            if (Object.keys(info.dataAttrs).length === 0) delete info.dataAttrs;
            if (Object.keys(info.attrs).length === 0) delete info.attrs;

            const children = Array.from(el.children);
            if (children.length > 0) {
                info.children = children.map(c => walkTree(c, depth + 1)).filter(Boolean);
            }
            return info;
        };

        report.titleCardAnatomy = walkTree(firstCard);
    } else {
        report.titleCardAnatomy = 'No .title-card-container found on this page';
    }

    // ── 4. All Selector Candidates for Title Cards ──────────────────

    const selectorTests = [
        { name: '.ptrack-content', selector: '.ptrack-content' },
        { name: '.title-card', selector: '.title-card' },
        { name: '.title-card-container', selector: '.title-card-container' },
        { name: '.slider-item', selector: '.slider-item' },
        { name: '.slider-item .ptrack-content', selector: '.slider-item .ptrack-content' },
        { name: '.title-card-container .ptrack-content', selector: '.title-card-container .ptrack-content' },
        { name: '.title-card .ptrack-content', selector: '.title-card .ptrack-content' },
        { name: '.lolomoRow .ptrack-content', selector: '.lolomoRow .ptrack-content' },
        { name: '[data-uia="title-card-container"]', selector: '[data-uia="title-card-container"]' },
        { name: '.boxart-container', selector: '.boxart-container' },
        { name: '.slider-refocus', selector: '.slider-refocus' },
    ];

    // Also check for billboard false positives
    const billboardPtracks = collectSelectors(document, '.billboard .ptrack-content, .billboard-row .ptrack-content');

    report.selectorCandidates = {
        note: 'Counts of elements matched by each selector — pick the one that matches ONLY title cards',
        results: selectorTests.map(t => ({
            selector: t.name,
            matchCount: document.querySelectorAll(t.selector).length
        })),
        billboardPtrackCount: billboardPtracks.length,
        recommendation: null // filled below
    };

    // Figure out which selector is most accurate
    const titleCardCount = document.querySelectorAll('.title-card-container').length;
    const bestSelector = selectorTests.find(t =>
        document.querySelectorAll(t.selector).length === titleCardCount && titleCardCount > 0
    );
    report.selectorCandidates.recommendation = bestSelector
        ? `Use "${bestSelector.name}" (matches ${titleCardCount} title cards with zero billboard false positives)`
        : `No perfect match found. .title-card-container has ${titleCardCount} elements.`;

    // ── 5. Data Attributes & Tracking Context ───────────────────────

    const trackingContexts = [];
    collectSelectors(document, '.ptrack-content[data-ui-tracking-context]').forEach(el => {
        const raw = el.getAttribute('data-ui-tracking-context');
        const parsed = safeJSON(raw);
        if (parsed) trackingContexts.push(parsed);
    });

    if (trackingContexts.length > 0) {
        const sample = trackingContexts[0];
        report.trackingContext = {
            totalElements: trackingContexts.length,
            availableFields: Object.keys(sample),
            sampleEntry: sample,
            allVideoIds: unique(trackingContexts.map(t => t.video_id).filter(Boolean)),
            allLocations: unique(trackingContexts.map(t => t.location).filter(Boolean)),
            allAppViews: unique(trackingContexts.map(t => t.appView).filter(Boolean))
        };
    }

    // ── 6. Netflix Native Progress Bars ─────────────────────────────

    const nativeProgressBars = collectSelectors(document, '.progress');
    report.nativeProgress = {
        count: nativeProgressBars.length,
        details: nativeProgressBars.map(bar => {
            const completed = bar.querySelector('.progress-completed');
            const width = completed ? completed.style.width : null;
            const parent = bar.closest('.title-card-container');
            const link = parent ? parent.querySelector('a.slider-refocus') : null;
            const title = link ? link.getAttribute('aria-label') : null;
            const href = link ? link.getAttribute('href') : null;

            return { title, width, href, parentSelector: parent ? '.title-card-container' : bar.parentElement?.className };
        }),
        note: 'Netflix already renders these — read .progress-completed style.width instead of duplicating'
    };

    // ── 7. Billboard / Hero Section ─────────────────────────────────

    const billboard = document.querySelector('.billboard');
    report.billboard = {
        exists: !!billboard,
        classes: billboard ? billboard.className : null,
        videoId: null,
        title: null,
        ptrackContentCount: billboard ? billboard.querySelectorAll('.ptrack-content').length : 0
    };

    if (billboard) {
        const titleLogo = billboard.querySelector('.title-logo');
        report.billboard.title = titleLogo ? (titleLogo.alt || titleLogo.getAttribute('title')) : null;

        const ctx = billboard.querySelector('.ptrack-content[data-ui-tracking-context]');
        if (ctx) {
            const parsed = safeJSON(ctx.getAttribute('data-ui-tracking-context'));
            if (parsed) report.billboard.videoId = parsed.video_id;
        }
    }

    // ── 8. Video Player (Watch Page) ────────────────────────────────

    const video = document.querySelector('video');
    report.videoPlayer = {
        exists: !!video,
        src: video ? truncate(video.src) : null,
        currentTime: video ? video.currentTime : null,
        duration: video ? video.duration : null,
        paused: video ? video.paused : null,
        readyState: video ? video.readyState : null
    };

    // Player UI buttons
    const playerButtons = [
        'player-skip-intro',
        'player-skip-recap',
        'next-episode-seamless-button',
        'player-skip-preplay',
        'button-nfplayerPlay',
        'button-nfplayerPause',
        'button-nfplayerFullscreen',
        'button-nfplayerBackTen',
        'button-nfplayerFwdTen',
        'control-speed',
        'player-slider',
    ];

    report.playerUI = {
        buttons: playerButtons.map(uia => ({
            dataUia: uia,
            found: !!document.querySelector(`[data-uia="${uia}"]`),
            visible: (() => {
                const el = document.querySelector(`[data-uia="${uia}"]`);
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            })()
        })),
        allDataUia: unique(
            collectSelectors(document, '[data-uia]').map(el => el.getAttribute('data-uia'))
        ).sort()
    };

    // ── 9. Top 10 / Ranked Cards ────────────────────────────────────

    const top10Cards = collectSelectors(document, '.title-card-top-10');
    report.top10 = {
        count: top10Cards.length,
        hasRankSvg: top10Cards.length > 0 && !!top10Cards[0].querySelector('svg[class*="rank"]'),
        boxartSize: top10Cards.length > 0
            ? top10Cards[0].querySelector('.boxart-container')?.className : null,
        note: 'Top 10 cards use .boxart-size-7x10 (portrait) vs .boxart-size-16x9 (landscape) for regular cards'
    };

    // ── 10. Image Keys & Badge System ───────────────────────────────

    const badges = [];
    trackingContexts.forEach(ctx => {
        const key = ctx.image_key || '';
        const badgeMatches = key.match(/BADGE\|([^|]+)\|/g);
        if (badgeMatches) {
            badgeMatches.forEach(b => badges.push(b.replace(/BADGE\||\|/g, '')));
        }
    });

    report.badges = {
        uniqueBadgeTypes: unique(badges),
        note: 'Badges like "newcontent:new.season", "recently.added", "leaving.soon" found in image_key of tracking context'
    };

    // ── 11. Link / URL Patterns ─────────────────────────────────────

    const watchLinks = collectSelectors(document, 'a[href*="/watch/"]');
    const titleLinks = collectSelectors(document, 'a[href*="/title/"]');

    report.linkPatterns = {
        watchLinks: watchLinks.length,
        titleLinks: titleLinks.length,
        sampleWatchHref: watchLinks[0] ? truncate(watchLinks[0].getAttribute('href')) : null,
        sampleTitleHref: titleLinks[0] ? truncate(titleLinks[0].getAttribute('href')) : null,
        videoIdRegex: '/\\/(?:watch|title)\\/(\\d+)/',
    };

    // ── 12. Netflix React/App State ─────────────────────────────────

    report.appState = {
        netflix: typeof window.netflix !== 'undefined',
        netflixKeys: typeof window.netflix === 'object' ? Object.keys(window.netflix) : [],
        reactFiber: !!document.querySelector('[data-reactroot], [__reactFiber], [__reactContainer]'),
        authUrl: !!document.querySelector('meta[name="authURL"]'),
        buildId: document.querySelector('meta[name="buildId"]')?.content || null,
    };

    // Check for netflix.falcorCache or similar
    if (typeof window.netflix === 'object') {
        const dig = (obj, depth = 0) => {
            if (depth > 2 || !obj) return [];
            const keys = Object.keys(obj);
            return keys.slice(0, 20); // limit
        };
        report.appState.netflixSubkeys = dig(window.netflix);

        // Common API paths
        ['appContext', 'falcorCache', 'reactContext', 'player', 'cadmium'].forEach(key => {
            report.appState[`has_${key}`] = key in (window.netflix || {});
        });
    }

    // ── 13. Maturity Ratings ────────────────────────────────────────

    const maturityEls = collectSelectors(document, '.maturity-rating .maturity-number, [data-uia="maturity-rating"]');
    report.maturityRatings = {
        count: maturityEls.length,
        values: unique(maturityEls.map(el => el.textContent.trim())),
    };

    // ── 14. Genre / Metadata Tags ───────────────────────────────────

    const genreLinks = collectSelectors(document, 'a[href*="/genre/"], a[href*="/browse/m/genre/"]');
    report.genres = {
        count: genreLinks.length,
        list: unique(genreLinks.map(el => ({
            text: el.textContent.trim(),
            href: el.getAttribute('href')
        })).map(g => `${g.text} (${g.href})`))
    };

    // ── 15. Bob Card (Hover Preview Popup) ──────────────────────────

    const bobContainer = document.querySelector('.bob-container');
    const bobCard = document.querySelector('.bob-card');
    report.bobCard = {
        bobContainersCount: document.querySelectorAll('.bob-container').length,
        activeBobCard: !!bobCard,
        bobCardClasses: bobCard ? bobCard.className : null,
        note: 'Bob cards are the expanded hover popups — they appear inside .bob-container when user hovers a title card'
    };

    // ── 16. Useful CSS Classes Inventory ────────────────────────────

    const classInventory = [
        '.lolomo', '.lolomoRow', '.rowContainer', '.rowContent', '.rowHeader',
        '.slider', '.sliderMask', '.sliderContent', '.slider-item',
        '.title-card-container', '.title-card', '.title-card-top-10',
        '.ptrack-content', '.ptrack-container',
        '.boxart-container', '.boxart-image', '.boxart-rounded',
        '.boxart-size-16x9', '.boxart-size-7x10',
        '.fallback-text-container', '.fallback-text',
        '.progress', '.progress-bar', '.progress-completed',
        '.billboard', '.billboard-row', '.billboard-title', '.title-logo',
        '.synopsis', '.episode-title-container',
        '.bob-container', '.bob-card',
        '.PlayerControlsNeo__layout', '.PlayerControlsNeo__bottom-controls',
        '.nf-player-container', '.VideoContainer',
        '.watch-video--player-view',
        '.evidence-list', '.evidence-item',
        '.previewModal',
    ];

    report.classInventory = classInventory.map(cls => ({
        selector: cls,
        found: document.querySelectorAll(cls).length
    })).filter(c => c.found > 0);

    // ── 17. All data-uia Values ─────────────────────────────────────

    report.allDataUia = unique(
        collectSelectors(document, '[data-uia]').map(el => ({
            value: el.getAttribute('data-uia'),
            tag: el.tagName.toLowerCase(),
            classes: truncate(el.className, 60)
        })).map(x => `${x.value} (${x.tag}.${x.classes})`)
    ).sort();

    // ── 18. Accessibility Labels (for title extraction) ─────────────

    const ariaLabels = collectSelectors(document, '.slider-refocus[aria-label]');
    report.ariaLabels = {
        count: ariaLabels.length,
        sample: ariaLabels.slice(0, 10).map(el => ({
            label: el.getAttribute('aria-label'),
            href: el.getAttribute('href'),
            hidden: el.getAttribute('aria-hidden')
        })),
        note: 'These are the <a> links inside title cards — aria-label has the title name'
    };

    // ── Output ──────────────────────────────────────────────────────

    console.clear();
    console.log('%c╔══════════════════════════════════════════╗', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c║     Netflix DOM Inspector Report         ║', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════╝', 'color: #e50914; font-size: 14px; font-weight: bold');

    const sections = [
        ['1. Page Context', report.page],
        ['2. Rows (.lolomoRow)', report.rows],
        ['3. Title Card Anatomy (first card DOM tree)', report.titleCardAnatomy],
        ['4. Selector Candidates (pick the right one!)', report.selectorCandidates],
        ['5. Tracking Context (data-ui-tracking-context)', report.trackingContext],
        ['6. Native Progress Bars', report.nativeProgress],
        ['7. Billboard / Hero', report.billboard],
        ['8. Video Player', report.videoPlayer],
        ['9. Player UI Buttons', report.playerUI],
        ['10. Top 10 Cards', report.top10],
        ['11. Badge System', report.badges],
        ['12. Link Patterns', report.linkPatterns],
        ['13. Netflix App State (window.netflix)', report.appState],
        ['14. Maturity Ratings', report.maturityRatings],
        ['15. Genres', report.genres],
        ['16. Bob Card (Hover Popup)', report.bobCard],
        ['17. CSS Class Inventory', report.classInventory],
        ['18. All data-uia Values', report.allDataUia],
        ['19. Aria Labels (title extraction)', report.ariaLabels],
    ];

    sections.forEach(([title, data]) => {
        console.groupCollapsed(`%c${title}`, 'color: #46d369; font-weight: bold; font-size: 12px');
        console.log(JSON.parse(JSON.stringify(data, null, 2)));
        console.groupEnd();
    });

    // Copy-friendly full dump
    console.log('%c\n📋 Full report copied to clipboard (also stored in window.__nfxInspector)', 'color: #aaa');
    window.__nfxInspector = report;

    try {
        copy(JSON.stringify(report, null, 2));
    } catch {
        console.log('%c(Could not auto-copy — use: copy(JSON.stringify(window.__nfxInspector, null, 2)))', 'color: #888');
    }

    return report;
})();
