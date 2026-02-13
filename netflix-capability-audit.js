// Netflix Capability Audit — maps every exploitable surface for feature development
// Run in browser console on netflix.com. Auto-copies results.
(() => {
    const report = {};

    const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
    const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

    // ── 1. FALCOR CACHE — What data Netflix stores per video ──────────

    report.falcorCache = (() => {
        const cache = safe(() => window.netflix?.falcorCache);
        if (!cache) return { available: false };

        const result = { available: true, topLevelKeys: Object.keys(cache).sort() };

        if (cache.videos) {
            const videoIds = Object.keys(cache.videos);
            result.videoCount = videoIds.length;

            // Sample ONE video to map available keys + structure
            const allVideoKeys = new Set();
            const firstVideo = cache.videos[videoIds[0]];
            if (firstVideo && typeof firstVideo === 'object') {
                const keys = Object.keys(firstVideo);
                keys.forEach(k => allVideoKeys.add(k));

                // Summarize key types (not full drill)
                const keyTypes = {};
                for (const k of keys.slice(0, 30)) {
                    const val = firstVideo[k];
                    if (val && typeof val === 'object') {
                        if (val.value !== undefined) keyTypes[k] = typeof val.value;
                        else if (val.$type) keyTypes[k] = val.$type;
                        else keyTypes[k] = 'object(' + Object.keys(val).length + ' keys)';
                    } else {
                        keyTypes[k] = typeof val;
                    }
                }
                result.sampleVideoKeyTypes = keyTypes;
            }
            result.allVideoKeys = [...allVideoKeys].sort();
        }

        if (cache.lolomos) result.lolomoCount = Object.keys(cache.lolomos).length;
        if (cache.lists) result.listCount = Object.keys(cache.lists).length;
        if (cache.person) result.personCount = Object.keys(cache.person).length;
        if (cache.genres) result.genreCount = Object.keys(cache.genres).length;
        if (cache.seasons) result.seasonCount = Object.keys(cache.seasons).length;
        if (cache.episodes) result.episodeCount = Object.keys(cache.episodes).length;

        return result;
    })();

    // ── 2. NETFLIX PLAYER API ─────────────────────────────────────────

    report.playerAPI = (() => {
        const player = safe(() => window.netflix?.player);
        if (!player) return { available: false };

        const result = { available: true, topLevelKeys: Object.keys(player) };

        const videoPlayer = safe(() => {
            const api = player.getVideoPlayerBySessionId;
            if (!api) return null;
            const sessions = safe(() => player.getAllPlayerSessionIds?.()) || [];
            result.sessions = sessions;
            return sessions.length > 0 ? api.call(player, sessions[0]) : null;
        });

        if (videoPlayer) {
            result.activePlayerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(videoPlayer))
                .filter(m => typeof videoPlayer[m] === 'function').sort();

            const propGetters = ['getCurrentTime', 'getDuration', 'getVolume', 'isMuted',
                'isPaused', 'isPlaying', 'getPlaybackRate', 'getVideoId'];
            result.activePlayerProperties = {};
            for (const m of propGetters) {
                if (typeof videoPlayer[m] === 'function')
                    result.activePlayerProperties[m] = safe(() => videoPlayer[m]());
            }

            result.audioTrackCount = safe(() => videoPlayer.getAudioTrackList?.()?.length) || 0;
            result.textTrackCount = safe(() => videoPlayer.getTextTrackList?.()?.length) || 0;
        }

        return result;
    })();

    // ── 3. REACT CONTEXT — User, profiles, preferences ────────────────

    report.reactContext = (() => {
        const ctx = safe(() => window.netflix?.reactContext);
        if (!ctx) return { available: false };

        const result = { available: true, topLevelKeys: Object.keys(ctx) };

        if (ctx.models) {
            result.modelKeys = Object.keys(ctx.models);
            result.userInfo = safe(() => ({
                membershipStatus: ctx.models.memberContext?.data?.membershipStatus,
                countryOfSignup: ctx.models.memberContext?.data?.countryOfSignup,
                showAds: ctx.models.memberContext?.data?.showAds
            }));
            result.activeProfile = safe(() => ({
                guid: ctx.models.activeProfile?.guid,
                name: ctx.models.activeProfile?.firstName,
                isKids: ctx.models.activeProfile?.isKids,
                language: ctx.models.activeProfile?.language
            }));
            result.abTestCount = safe(() => Object.keys(ctx.models.abContext?.data?.tests || {}).length);
            result.serverDefKeys = safe(() => Object.keys(ctx.models.serverDefs?.data || {}));
            result.geo = safe(() => {
                const geo = ctx.models.geo?.data;
                if (!geo) return null;
                return {
                    locales: geo.supportedLocales?.map(l => l.id) || [],
                    country: geo.requestCountry?.id,
                    status: geo.requestCountry?.status,
                    locale: geo.preferredLocale?.id
                };
            });
        }

        return result;
    })();

    // ── 4. APP CONTEXT ────────────────────────────────────────────────

    report.appContext = (() => {
        const ctx = safe(() => window.netflix?.appContext);
        if (!ctx) return { available: false };
        return {
            available: true,
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(ctx))
                .filter(m => typeof ctx[m] === 'function'),
            modelKeys: safe(() => Object.keys(ctx.getModelData?.() || {}))
        };
    })();

    // ── 5. VIDEO ELEMENT CAPABILITIES ─────────────────────────────────

    report.videoElement = (() => {
        const video = document.querySelector('video');
        if (!video) return { available: false };
        return {
            available: true,
            currentTime: video.currentTime,
            duration: video.duration,
            playbackRate: video.playbackRate,
            paused: video.paused,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            textTrackCount: video.textTracks?.length || 0,
            pictureInPictureEnabled: document.pictureInPictureEnabled,
            mediaKeys: !!video.mediaKeys
        };
    })();

    // ── 6. DOM SURFACES — Everything we can hook into ─────────────────

    report.domSurfaces = (() => {
        const result = {};

        result.bobCard = { exists: !!document.querySelector('.bob-card') };

        // data-uia values (capped)
        const uiaValues = [...new Set(qsa('[data-uia]').map(el => el.getAttribute('data-uia')))].sort();
        result.dataUiaCount = uiaValues.length;
        result.dataUiaValues = uiaValues.slice(0, 40);

        // Row summaries (just titles + count)
        const rows = qsa('.lolomoRow');
        result.rowCount = rows.length;
        result.rows = rows.slice(0, 15).map(row => {
            const header = row.querySelector('.row-header-title, h2, [class*="rowHeader"]');
            return {
                title: header?.textContent?.trim()?.substring(0, 50),
                cardCount: row.querySelectorAll('.title-card-container').length
            };
        });

        result.billboard = { exists: !!document.querySelector('.billboard') };
        result.notifications = { bellExists: !!document.querySelector('[data-uia="notification-bell"]') };
        result.search = { exists: !!document.querySelector('[data-uia="search-box"]') };

        return result;
    })();

    // ── 7. PLAYER UI CONTROLS ─────────────────────────────────────────

    report.playerUI = (() => {
        const controls = document.querySelector('.watch-video--bottom-controls-container, [data-uia="controls-standard"]');
        if (!controls) return { available: false };
        return {
            available: true,
            buttons: qsa('button', controls).map(b => b.getAttribute('aria-label') || b.getAttribute('data-uia')).filter(Boolean),
            scrubber: !!controls.querySelector('.scrubber-container, [data-uia="timeline"]')
        };
    })();

    // ── 8. STORAGE KEYS ───────────────────────────────────────────────

    report.storage = (() => {
        const lsKeys = [];
        for (let i = 0; i < localStorage.length; i++) lsKeys.push(localStorage.key(i));
        const ssKeys = [];
        for (let i = 0; i < sessionStorage.length; i++) ssKeys.push(sessionStorage.key(i));
        return {
            localStorageCount: lsKeys.length,
            localStorageKeys: lsKeys.sort(),
            sessionStorageCount: ssKeys.length,
            sessionStorageKeys: ssKeys.sort()
        };
    })();

    // ── 9. COOKIES ────────────────────────────────────────────────────

    report.cookies = {
        count: document.cookie.split(';').length,
        names: document.cookie.split(';').map(c => c.trim().split('=')[0]).sort()
    };

    // ── 10. NETWORK PATTERNS ──────────────────────────────────────────

    report.networkHints = (() => {
        const entries = performance.getEntriesByType('resource');
        const apiPatterns = new Set();
        const cdnHosts = new Set();

        entries.forEach(e => {
            const url = e.name;
            // Only real API calls, not CDN image/video paths
            if ((url.includes('/api/') || url.includes('/shakti/') || url.includes('/pathEvaluator'))
                && !url.includes('/dnm/')) {
                const path = safe(() => new URL(url).pathname.split('?')[0]);
                if (path) apiPatterns.add(path);
            }
            if (url.includes('nflxvideo') || url.includes('nflximg') || url.includes('nflxso'))
                cdnHosts.add(safe(() => new URL(url).hostname));
        });

        return {
            apiEndpoints: [...apiPatterns].sort().slice(0, 15),
            cdnHosts: [...cdnHosts].filter(Boolean).sort(),
            totalResources: entries.length
        };
    })();

    // ── 11. GENRES FROM CACHE ─────────────────────────────────────────

    report.genres = (() => {
        const cache = safe(() => window.netflix?.falcorCache?.genres);
        if (!cache) return { available: false };
        const genres = Object.keys(cache).map(id => ({
            id, name: safe(() => cache[id]?.name?.value)
        })).filter(g => g.name);
        return { available: true, count: genres.length, sample: genres.slice(0, 10) };
    })();

    // ── 12. WATCH HISTORY CLUES ───────────────────────────────────────

    report.watchHistory = (() => {
        const cache = safe(() => window.netflix?.falcorCache);
        if (!cache?.videos) return { available: false };

        let bookmarkCount = 0, queueCount = 0;
        for (const v of Object.values(cache.videos)) {
            if (v?.bookmarkPosition || v?.bookmark) bookmarkCount++;
            if (v?.queue || v?.inRemindMeList) queueCount++;
        }
        return { videosWithBookmarks: bookmarkCount, videosInQueue: queueCount };
    })();

    // ── 13. BROWSER CAPABILITIES ──────────────────────────────────────

    report.browserCapabilities = {
        pictureInPicture: document.pictureInPictureEnabled,
        fullscreen: !!document.fullscreenEnabled,
        mediaSession: !!navigator.mediaSession,
        notifications: 'Notification' in window ? Notification.permission : 'unsupported',
        clipboard: !!navigator.clipboard,
        share: !!navigator.share,
        wakeLock: 'wakeLock' in navigator
    };

    // ── 14. WINDOW GLOBALS ────────────────────────────────────────────

    report.windowGlobals = (() => {
        const globals = {};
        for (const key of ['netflix', 'NREUM', 'newrelic', '__NEXT_DATA__', 'webpackJsonp', 'requirejs', 'nrdp']) {
            if (window[key] !== undefined)
                globals[key] = typeof window[key] === 'object' ? Object.keys(window[key]).slice(0, 10) : typeof window[key];
        }
        return globals;
    })();

    // ── 15. MUTATION TARGETS ──────────────────────────────────────────

    report.mutationTargets = {
        mainContent: !!document.querySelector('.mainView, [data-uia="main-view"]'),
        lolomoContainer: !!document.querySelector('.lolomoRow, [data-uia="lolomo-container"]'),
        playerContainer: !!document.querySelector('.watch-video, [data-uia="player"]'),
        previewModal: !!document.querySelector('.previewModal--container')
    };

    // ── 16. FEATURE FEASIBILITY MATRIX ────────────────────────────────

    report.featureMatrix = (() => {
        const P = !!safe(() => window.netflix?.player);
        const C = !!safe(() => window.netflix?.falcorCache);
        const V = !!document.querySelector('video');
        const B = window.location.pathname.includes('/browse');

        // Compact: feature → [feasible, requires]
        return {
            'IMDb/RT Ratings':           [true, 'OMDb/TMDB API + video IDs from cache'],
            'Enhanced Subtitles':        [V, 'video.textTracks + CSS overlay'],
            'Picture-in-Picture':        [document.pictureInPictureEnabled, 'video.requestPictureInPicture()'],
            'Playback Speed Memory':     [true, 'localStorage + player.setPlaybackRate'],
            'Audio/Sub Quick Switch':    [P, 'player.getAudioTrackList/getTextTrackList'],
            'Quality Override':          [P, 'player.setMaxBitrate'],
            'Watch Stats Dashboard':     [true, 'localStorage + player currentTime'],
            'Custom Keyboard Shortcuts': [true, 'keydown listener + configurable bindings'],
            'Row Filtering':             [B, 'CSS display:none on .lolomoRow'],
            'Hidden Genre Browser':      [C, 'genre IDs → /browse/genre/{id}'],
            'Spoiler-Free Mode':         [B, 'blur .synopsis, thumbnails, descriptions'],
            'Continue Watching Cleanup': [B, 'hide cards in CW row + localStorage'],
            'Random Episode Picker':     [C, 'seasons/episodes from cache → random'],
            'Sleep Timer':               [V, 'countdown → player.pause()'],
            'Binge Mode (skip intro)':   [V, 'MutationObserver → auto-click skip buttons'],
            'Export Watch History':       [C, 'falcorCache bookmarks → CSV/JSON'],
            'Ambient Light Effect':      [V, 'canvas getImageData → glow border'],
            'Profile-Specific Settings': [!!safe(() => window.netflix?.reactContext?.models?.activeProfile), 'localStorage per profile GUID']
        };
    })();

    // ── SUMMARY ───────────────────────────────────────────────────────

    report._summary = {
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
        falcorCacheAvailable: report.falcorCache.available,
        playerAPIAvailable: report.playerAPI.available,
        videoCount: report.falcorCache.videoCount || 0,
        genreCount: report.genres?.count || 0,
        rowCount: report.domSurfaces.rowCount || 0,
        feasibleFeatures: Object.values(report.featureMatrix).filter(v => v[0]).length,
        totalFeatures: Object.keys(report.featureMatrix).length
    };

    // Output
    const seen = new WeakSet();
    const json = JSON.stringify(report, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    }, 2);
    copy(json);
    console.log('%c[Netflix Capability Audit]', 'color: #7c3aed; font-weight: bold; font-size: 14px',
        `Done! ${(json.length / 1024).toFixed(1)} KB copied to clipboard`);
    console.log(`${report._summary.feasibleFeatures}/${report._summary.totalFeatures} features feasible on this page`);
    return 'Copied to clipboard!';
})();
