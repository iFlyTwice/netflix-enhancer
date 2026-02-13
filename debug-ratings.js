// Debug Ratings — paste in console on netflix.com to diagnose why ratings aren't showing
(() => {
    const log = (label, data) => console.log(`%c[Ratings Debug] ${label}`, 'color: #f59e0b; font-weight: bold', data);
    const err = (label, data) => console.error(`%c[Ratings Debug] ${label}`, 'color: #ef4444; font-weight: bold', data);
    const ok = (label, data) => console.log(`%c[Ratings Debug] ${label}`, 'color: #22c55e; font-weight: bold', data);

    // 1. Check if core loaded with ratings support
    log('1. Core version', window.__NETFLIX_ENHANCER_CORE_VERSION || 'NOT LOADED');
    log('1. Core source', window.__NETFLIX_ENHANCER_CORE_SOURCE || 'unknown');

    // 2. Check localStorage ratings cache
    try {
        const raw = localStorage.getItem('netflix_enhancer_ratings');
        const cache = raw ? JSON.parse(raw) : null;
        if (cache) {
            const keys = Object.keys(cache);
            ok('2. Ratings cache', `${keys.length} entries`);
            keys.slice(0, 5).forEach(k => log(`   cached: "${k}"`, cache[k]));
        } else {
            log('2. Ratings cache', 'EMPTY — no ratings fetched yet');
        }
    } catch (e) {
        err('2. Ratings cache', e.message);
    }

    // 3. Check config
    try {
        const raw = localStorage.getItem('netflix_enhancer_config');
        const config = raw ? JSON.parse(raw) : {};
        log('3. showRatings config', config.showRatings !== undefined ? config.showRatings : 'NOT SET (defaults to true)');
    } catch (e) {
        err('3. Config', e.message);
    }

    // 4. Check Falcor cache for video titles
    const falcor = window.netflix?.falcorCache;
    if (falcor?.videos) {
        const ids = Object.keys(falcor.videos).slice(0, 5);
        ok('4. Falcor videos', `${Object.keys(falcor.videos).length} total`);
        ids.forEach(id => {
            const v = falcor.videos[id];
            const title = v?.title?.value || v?.summary?.value?.title || 'NO TITLE';
            const year = v?.releaseYear?.value || 'NO YEAR';
            log(`   video ${id}`, `"${title}" (${year})`);
        });
    } else {
        err('4. Falcor videos', 'NOT AVAILABLE');
    }

    // 5. Check title cards in DOM
    const cards = document.querySelectorAll('.title-card-container');
    log('5. Title cards in DOM', cards.length);

    let enhanced = 0, hasRating = 0, hasVideoId = 0;
    cards.forEach(card => {
        if (card.dataset.neEnhanced) enhanced++;
        if (card.querySelector('.ne-rating-badge')) hasRating++;

        // Try to extract video ID the same way the code does
        const ptrack = card.querySelector('.ptrack-content[data-ui-tracking-context]');
        if (ptrack) {
            try {
                const ctx = JSON.parse(decodeURIComponent(ptrack.getAttribute('data-ui-tracking-context')));
                if (ctx.video_id) hasVideoId++;
            } catch {}
        }
    });
    log('   enhanced', enhanced);
    log('   with rating badge', hasRating);
    log('   with video ID (ptrack)', hasVideoId);

    // 6. Check if GM_xmlhttpRequest is accessible
    log('6. GM_xmlhttpRequest', typeof GM_xmlhttpRequest !== 'undefined' ? 'AVAILABLE' : 'NOT IN THIS CONTEXT (expected — only in userscript sandbox)');

    // 7. Test OMDB API directly via fetch (will likely CORS-fail, but shows the attempt)
    const testTitle = falcor?.videos ? (() => {
        const firstId = Object.keys(falcor.videos)[0];
        return falcor.videos[firstId]?.title?.value || 'Suits';
    })() : 'Suits';

    log('7. Testing OMDB fetch for', `"${testTitle}"`);
    fetch(`https://www.omdbapi.com/?apikey=f4277fe7&t=${encodeURIComponent(testTitle)}`)
        .then(r => r.json())
        .then(d => {
            if (d.Response === 'True') {
                ok('7. OMDB direct fetch', `"${d.Title}" — IMDb: ${d.imdbRating}`);
                log('   (This means the API key works. If ratings still dont show, GM_xmlhttpRequest is blocked.)');
            } else {
                err('7. OMDB response', d.Error || d);
            }
        })
        .catch(e => {
            err('7. OMDB fetch failed (CORS expected from console)', e.message);
            log('   This is normal from console. GM_xmlhttpRequest bypasses CORS in Tampermonkey.');
        });

    // 8. Check billboard
    const billboard = document.querySelector('.ne-billboard-rating');
    log('8. Billboard rating badge', billboard ? 'EXISTS' : 'NOT FOUND');
    const billboardBtn = document.querySelector('.ne-billboard-list-btn');
    log('8. Billboard list button', billboardBtn ? 'EXISTS' : 'NOT FOUND');

    // 9. Check for any rating-related errors in the existing badges
    const allBadges = document.querySelectorAll('.ne-rating-badge');
    log('9. Total rating badges on page', allBadges.length);

    console.log('%c[Ratings Debug] Done. Check results above.', 'color: #7c3aed; font-weight: bold; font-size: 14px');
})();
