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

        // Video data structure
        if (cache.videos) {
            const videoIds = Object.keys(cache.videos);
            result.videoCount = videoIds.length;

            // Sample a few videos to map all available keys
            const allVideoKeys = new Set();
            const sampleVideos = [];
            for (const id of videoIds.slice(0, 5)) {
                const v = cache.videos[id];
                if (v && typeof v === 'object') {
                    const keys = Object.keys(v);
                    keys.forEach(k => allVideoKeys.add(k));
                    const sample = { id, keys };

                    // Drill into each key to see what sub-data exists
                    const drilled = {};
                    for (const k of keys) {
                        const val = v[k];
                        if (val && typeof val === 'object') {
                            if (val.value !== undefined) {
                                drilled[k] = { type: 'leaf', valueType: typeof val.value, sample: String(val.value).substring(0, 100) };
                            } else if (val.$type) {
                                drilled[k] = { type: val.$type, value: val.value !== undefined ? String(val.value).substring(0, 100) : undefined };
                            } else {
                                drilled[k] = { type: 'object', subKeys: Object.keys(val).slice(0, 15) };
                            }
                        } else {
                            drilled[k] = { type: typeof val, sample: val !== null ? String(val).substring(0, 80) : null };
                        }
                    }
                    sample.structure = drilled;
                    sampleVideos.push(sample);
                }
            }
            result.allVideoKeys = [...allVideoKeys].sort();
            result.sampleVideos = sampleVideos;
        }

        // Lists / lolomos
        if (cache.lolomos) {
            const lomoKeys = Object.keys(cache.lolomos);
            result.lolomoCount = lomoKeys.length;
            const firstLomo = cache.lolomos[lomoKeys[0]];
            if (firstLomo) {
                result.lolomoSampleKeys = Object.keys(firstLomo).slice(0, 20);
            }
        }

        // Lists
        if (cache.lists) {
            result.listCount = Object.keys(cache.lists).length;
            const listIds = Object.keys(cache.lists).slice(0, 3);
            result.listSamples = listIds.map(id => {
                const list = cache.lists[id];
                return {
                    id,
                    keys: list ? Object.keys(list).slice(0, 20) : [],
                    displayName: safe(() => list.displayName?.value),
                    context: safe(() => list.context?.value)
                };
            });
        }

        // Persons (actors, directors)
        if (cache.person) {
            result.personCount = Object.keys(cache.person).length;
            const personIds = Object.keys(cache.person).slice(0, 2);
            result.personSample = personIds.map(id => ({
                id,
                keys: Object.keys(cache.person[id] || {}).slice(0, 15)
            }));
        }

        // Genres
        if (cache.genres) {
            result.genreCount = Object.keys(cache.genres).length;
            result.genreIds = Object.keys(cache.genres).slice(0, 20);
            result.genreSamples = Object.keys(cache.genres).slice(0, 5).map(id => ({
                id,
                keys: Object.keys(cache.genres[id] || {}),
                name: safe(() => cache.genres[id]?.name?.value)
            }));
        }

        // Seasons
        if (cache.seasons) {
            result.seasonCount = Object.keys(cache.seasons).length;
            const seasonId = Object.keys(cache.seasons)[0];
            if (seasonId) {
                result.seasonSampleKeys = Object.keys(cache.seasons[seasonId]);
            }
        }

        // Episodes
        if (cache.episodes) {
            result.episodeCount = Object.keys(cache.episodes).length;
        }

        return result;
    })();

    // ── 2. NETFLIX PLAYER API ─────────────────────────────────────────

    report.playerAPI = (() => {
        const player = safe(() => window.netflix?.player);
        if (!player) return { available: false };

        const result = { available: true };
        result.topLevelKeys = Object.keys(player);

        // Try to get active player session
        const videoPlayer = safe(() => {
            const api = player.getVideoPlayerBySessionId;
            if (!api) return null;
            // Try to find active session
            const sessions = safe(() => player.getAllPlayerSessionIds?.()) || [];
            result.sessions = sessions;
            if (sessions.length > 0) {
                return api.call(player, sessions[0]);
            }
            return null;
        });

        if (videoPlayer) {
            result.activePlayerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(videoPlayer))
                .filter(m => typeof videoPlayer[m] === 'function')
                .sort();

            result.activePlayerProperties = {};
            const propGetters = ['getCurrentTime', 'getDuration', 'getVolume', 'isMuted',
                'isPaused', 'isPlaying', 'getPlaybackRate', 'getBufferLength',
                'getVideoId', 'getMovieId', 'getTitle'];
            for (const m of propGetters) {
                if (typeof videoPlayer[m] === 'function') {
                    result.activePlayerProperties[m] = safe(() => videoPlayer[m]());
                }
            }

            // Audio tracks
            result.audioTracks = safe(() => {
                const tracks = videoPlayer.getAudioTrackList?.();
                return tracks?.map(t => ({ id: t.id, lang: t.language, label: t.label || t.displayName }));
            });

            // Subtitle/text tracks
            result.textTracks = safe(() => {
                const tracks = videoPlayer.getTextTrackList?.();
                return tracks?.map(t => ({ id: t.id, lang: t.language, label: t.label || t.displayName, kind: t.kind }));
            });

            // Video quality
            result.videoQuality = safe(() => ({
                currentBitrate: videoPlayer.getCurrentVideoBitrate?.(),
                maxBitrate: videoPlayer.getMaxVideoBitrate?.(),
                playingBitrateVideo: videoPlayer.getPlayingBitrateVideo?.(),
                playingBitrateAudio: videoPlayer.getPlayingBitrateAudio?.()
            }));
        }

        return result;
    })();

    // ── 3. REACT CONTEXT — User, profiles, preferences ────────────────

    report.reactContext = (() => {
        const ctx = safe(() => window.netflix?.reactContext);
        if (!ctx) return { available: false };

        const result = { available: true, topLevelKeys: Object.keys(ctx) };

        // Models
        if (ctx.models) {
            result.modelKeys = Object.keys(ctx.models);
            // User info
            result.userInfo = safe(() => ({
                membershipStatus: ctx.models.memberContext?.data?.membershipStatus,
                countryOfSignup: ctx.models.memberContext?.data?.countryOfSignup,
                isNonMember: ctx.models.memberContext?.data?.isNonMember,
                showAds: ctx.models.memberContext?.data?.showAds
            }));
            // Active profile
            result.activeProfile = safe(() => ({
                guid: ctx.models.activeProfile?.guid,
                name: ctx.models.activeProfile?.firstName,
                isKids: ctx.models.activeProfile?.isKids,
                maturityLevel: ctx.models.activeProfile?.maturityLevel,
                language: ctx.models.activeProfile?.language
            }));
            // AB tests
            result.abTestKeys = safe(() => Object.keys(ctx.models.abContext?.data?.tests || {}).slice(0, 20));
            // Server defs
            result.serverDefKeys = safe(() => Object.keys(ctx.models.serverDefs?.data || {}));
            // Geolocation
            result.geo = safe(() => ctx.models.geo?.data);
        }

        return result;
    })();

    // ── 4. APP CONTEXT ────────────────────────────────────────────────

    report.appContext = (() => {
        const ctx = safe(() => window.netflix?.appContext);
        if (!ctx) return { available: false };

        const result = { available: true };
        result.methods = Object.getOwnPropertyNames(Object.getPrototypeOf(ctx))
            .filter(m => typeof ctx[m] === 'function');
        result.state = safe(() => ctx.getState?.());
        result.modelKeys = safe(() => Object.keys(ctx.getModelData?.() || {}));

        return result;
    })();

    // ── 5. VIDEO ELEMENT CAPABILITIES ─────────────────────────────────

    report.videoElement = (() => {
        const video = document.querySelector('video');
        if (!video) return { available: false, note: 'No video element (not on watch page)' };

        return {
            available: true,
            src: video.src ? video.src.substring(0, 80) : null,
            currentTime: video.currentTime,
            duration: video.duration,
            playbackRate: video.playbackRate,
            volume: video.volume,
            muted: video.muted,
            paused: video.paused,
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            textTracks: [...video.textTracks].map(t => ({
                kind: t.kind, label: t.label, language: t.language, mode: t.mode
            })),
            audioTracks: video.audioTracks ? [...video.audioTracks].length : 'API not available',
            pictureInPictureEnabled: document.pictureInPictureEnabled,
            isPiP: document.pictureInPictureElement === video,
            canRequestPiP: typeof video.requestPictureInPicture === 'function',
            mediaKeys: !!video.mediaKeys,
            buffered: video.buffered.length > 0 ? {
                start: video.buffered.start(0),
                end: video.buffered.end(video.buffered.length - 1)
            } : null
        };
    })();

    // ── 6. DOM SURFACES — Everything we can hook into ─────────────────

    report.domSurfaces = (() => {
        const result = {};

        // Bob card (hover popup) data
        const bobCard = document.querySelector('.bob-card');
        result.bobCard = {
            exists: !!bobCard,
            classes: bobCard?.className,
            dataAttributes: bobCard ? [...bobCard.attributes].filter(a => a.name.startsWith('data-')).map(a => ({ name: a.name, value: a.value.substring(0, 60) })) : [],
            innerStructure: bobCard ? [...bobCard.querySelectorAll('*')].map(el => el.className).filter(Boolean).slice(0, 30) : []
        };

        // Maturity ratings on page
        result.maturityRatings = qsa('.maturity-rating, [data-uia="maturity-rating"], .player-feature-badge').map(el => ({
            text: el.textContent.trim().substring(0, 20),
            classes: el.className
        }));

        // All data-uia values (Netflix's internal UI tracking)
        result.dataUiaValues = [...new Set(qsa('[data-uia]').map(el => el.getAttribute('data-uia')))].sort();

        // Row contexts (what types of rows exist)
        result.rowContexts = qsa('.lolomoRow').map(row => {
            const header = row.querySelector('.row-header-title, h2, [class*="rowHeader"]');
            const context = safe(() => {
                const el = row.querySelector('[data-ui-tracking-context]');
                return el ? JSON.parse(decodeURIComponent(el.getAttribute('data-ui-tracking-context')))?.list_context : null;
            });
            return {
                title: header?.textContent?.trim()?.substring(0, 50),
                context,
                cardCount: row.querySelectorAll('.title-card-container').length,
                hasTop10: row.querySelectorAll('[class*="top-10"], .top-10').length > 0
            };
        });

        // Billboard/hero structure
        const billboard = document.querySelector('.billboard');
        result.billboard = {
            exists: !!billboard,
            videoId: safe(() => {
                const ctx = billboard?.querySelector('.ptrack-content[data-ui-tracking-context]');
                return ctx ? JSON.parse(decodeURIComponent(ctx.getAttribute('data-ui-tracking-context'))).video_id : null;
            }),
            hasLogo: !!billboard?.querySelector('.title-logo'),
            hasSynopsis: !!billboard?.querySelector('.synopsis, .billboard-title .info-wrapper'),
            hasMaturity: !!billboard?.querySelector('.maturity-rating'),
            availableButtons: qsa('button, a', billboard || document.createElement('div')).map(b => b.getAttribute('data-uia') || b.textContent.trim().substring(0, 20)).filter(Boolean)
        };

        // Notification bell
        result.notifications = {
            bellExists: !!document.querySelector('[data-uia="notification-bell"]'),
            count: safe(() => document.querySelector('.notification-pill, [class*="notificationPill"]')?.textContent?.trim())
        };

        // Search
        result.search = {
            searchBoxExists: !!document.querySelector('[data-uia="search-box"]'),
            searchInputExists: !!document.querySelector('input[data-uia="search-box-input"]')
        };

        // Profile menu
        result.profiles = {
            profileMenuExists: !!document.querySelector('.profile-menu, [data-uia="profile-menu"]'),
            profileLinks: qsa('.profile-link, [data-uia*="profile"]').map(el => ({
                name: el.textContent.trim().substring(0, 20),
                dataUia: el.getAttribute('data-uia')
            }))
        };

        // Navigation
        result.navigation = {
            navItems: qsa('.navigation-tab, .secondary-navigation a, [data-uia*="nav"]').map(el => ({
                text: el.textContent.trim().substring(0, 30),
                href: el.href?.substring(0, 50),
                dataUia: el.getAttribute('data-uia')
            }))
        };

        return result;
    })();

    // ── 7. PLAYER UI CONTROLS (when on watch page) ───────────────────

    report.playerUI = (() => {
        const controls = document.querySelector('.watch-video--bottom-controls-container, [data-uia="controls-standard"]');
        if (!controls) return { available: false, note: 'Not on watch page or controls hidden' };

        return {
            available: true,
            buttons: qsa('button', controls).map(b => ({
                ariaLabel: b.getAttribute('aria-label'),
                dataUia: b.getAttribute('data-uia'),
                title: b.title,
                classes: b.className.substring(0, 60)
            })),
            scrubber: !!controls.querySelector('.scrubber-container, [data-uia="timeline"]'),
            volumeSlider: !!controls.querySelector('[data-uia="volume-slider"]'),
            subtitleMenu: !!controls.querySelector('[data-uia="subtitles-menu"]')
        };
    })();

    // ── 8. LOCAL STORAGE — What Netflix stores locally ─────────────────

    report.localStorage = (() => {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            keys.push({
                key,
                size: val?.length || 0,
                sample: val?.substring(0, 100),
                isJSON: safe(() => { JSON.parse(val); return true; }, false)
            });
        }
        return {
            totalKeys: keys.length,
            netflixKeys: keys.filter(k => k.key.includes('netflix') || k.key.includes('nf_') || k.key.includes('Netflix')),
            enhancerKeys: keys.filter(k => k.key.includes('enhancer')),
            allKeys: keys.map(k => ({ key: k.key, size: k.size, isJSON: k.isJSON }))
        };
    })();

    // ── 9. SESSION STORAGE ────────────────────────────────────────────

    report.sessionStorage = (() => {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            keys.push(key);
        }
        return { totalKeys: keys.length, keys: keys.sort() };
    })();

    // ── 10. COOKIES — Netflix-specific ────────────────────────────────

    report.cookies = (() => {
        const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
        return {
            count: cookies.length,
            names: cookies.sort()
        };
    })();

    // ── 11. SERVICE WORKER & CACHE API ────────────────────────────────

    report.serviceWorker = {
        registered: !!navigator.serviceWorker?.controller,
        scope: safe(() => navigator.serviceWorker?.controller?.scriptURL)
    };

    // ── 12. NETWORK PATTERNS — XHR/Fetch endpoints Netflix uses ──────

    report.networkHints = (() => {
        // Check performance entries for API patterns
        const entries = performance.getEntriesByType('resource');
        const apiPatterns = new Set();
        const cdnPatterns = new Set();

        entries.forEach(e => {
            const url = e.name;
            if (url.includes('/api/') || url.includes('/shakti/') || url.includes('/pathEvaluator'))
                apiPatterns.add(new URL(url).pathname.split('?')[0]);
            if (url.includes('nflxvideo') || url.includes('nflximg') || url.includes('nflxso'))
                cdnPatterns.add(new URL(url).hostname);
        });

        return {
            apiEndpoints: [...apiPatterns].sort().slice(0, 30),
            cdnHosts: [...cdnPatterns].sort(),
            totalResources: entries.length,
            resourceTypes: entries.reduce((acc, e) => {
                const type = e.initiatorType;
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {})
        };
    })();

    // ── 13. KEYBOARD EVENT LISTENERS ──────────────────────────────────

    report.keyboardHints = (() => {
        // Check for Netflix's keyboard shortcuts by inspecting known patterns
        const result = {
            knownNetflixShortcuts: {
                'Space': 'Play/Pause',
                'Enter': 'Play/Pause',
                'F': 'Fullscreen',
                'M': 'Mute/Unmute',
                'ArrowUp': 'Volume Up',
                'ArrowDown': 'Volume Down',
                'ArrowLeft': 'Rewind 10s',
                'ArrowRight': 'Forward 10s',
                'Escape': 'Exit fullscreen / Back',
                'S': 'Skip intro (when available)',
                'Shift+ArrowLeft': 'Previous episode',
                'Shift+ArrowRight': 'Next episode'
            },
            note: 'These are Netflix defaults — can be intercepted/extended'
        };
        return result;
    })();

    // ── 14. AVAILABLE GENRES FROM CACHE ───────────────────────────────

    report.genres = (() => {
        const cache = safe(() => window.netflix?.falcorCache?.genres);
        if (!cache) return { available: false };

        const genres = Object.keys(cache).map(id => ({
            id,
            name: safe(() => cache[id]?.name?.value),
            url: `/browse/genre/${id}`
        })).filter(g => g.name);

        return { available: true, count: genres.length, genres };
    })();

    // ── 15. WATCH HISTORY CLUES ───────────────────────────────────────

    report.watchHistory = (() => {
        const cache = safe(() => window.netflix?.falcorCache);
        if (!cache) return { available: false };

        // Check for bookmark data
        const videosWithBookmarks = [];
        const videosWithQueued = [];

        if (cache.videos) {
            for (const [id, v] of Object.entries(cache.videos)) {
                if (v?.bookmarkPosition || v?.bookmark) {
                    videosWithBookmarks.push({
                        id,
                        bookmarkPosition: safe(() => v.bookmarkPosition?.value),
                        runtime: safe(() => v.runtime?.value)
                    });
                }
                if (v?.queue || v?.inRemindMeList) {
                    videosWithQueued.push({
                        id,
                        inQueue: safe(() => v.queue?.value !== undefined),
                        inRemindMeList: safe(() => v.inRemindMeList?.value)
                    });
                }
            }
        }

        return {
            videosWithBookmarks: videosWithBookmarks.length,
            bookmarkSamples: videosWithBookmarks.slice(0, 5),
            videosInQueue: videosWithQueued.length,
            queueSamples: videosWithQueued.slice(0, 5)
        };
    })();

    // ── 16. SUBTITLE/AUDIO CAPABILITIES ───────────────────────────────

    report.mediaCapabilities = {
        pictureInPicture: document.pictureInPictureEnabled,
        fullscreenAPI: !!document.fullscreenEnabled,
        mediaSession: !!navigator.mediaSession,
        mediaSessionMetadata: safe(() => ({
            title: navigator.mediaSession?.metadata?.title,
            artist: navigator.mediaSession?.metadata?.artist,
            album: navigator.mediaSession?.metadata?.album,
            artwork: navigator.mediaSession?.metadata?.artwork?.length
        })),
        webkitAudioContext: typeof (window.AudioContext || window.webkitAudioContext) === 'function',
        speechSynthesis: 'speechSynthesis' in window,
        notifications: 'Notification' in window ? Notification.permission : 'not supported',
        clipboard: !!navigator.clipboard,
        share: !!navigator.share,
        wakeLock: 'wakeLock' in navigator
    };

    // ── 17. CSS CUSTOM PROPERTIES (Netflix theme values) ──────────────

    report.cssCustomProperties = (() => {
        const root = getComputedStyle(document.documentElement);
        const props = {};
        // Check common Netflix CSS variables
        const candidates = ['--color-primary', '--color-secondary', '--header-height',
            '--player-width', '--player-height', '--row-height', '--card-width'];
        for (const p of candidates) {
            const val = root.getPropertyValue(p).trim();
            if (val) props[p] = val;
        }

        // Also scan all stylesheets for custom properties
        const allVars = new Set();
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    const text = rule.cssText;
                    const matches = text.match(/--[\w-]+/g);
                    if (matches) matches.forEach(m => allVars.add(m));
                }
            } catch { /* cross-origin */ }
        }
        props.allCustomPropertiesCount = allVars.size;
        props.sampleCustomProperties = [...allVars].slice(0, 20).sort();

        return props;
    })();

    // ── 18. WINDOW GLOBALS — Anything Netflix exposes ─────────────────

    report.windowGlobals = (() => {
        const netflixGlobals = {};
        const interesting = ['netflix', 'NREUM', 'newrelic', '__NEXT_DATA__', 'webpackJsonp',
            '__NEXT_LOADED_PAGES__', 'requirejs', '__netflix', 'nrdp'];
        for (const key of interesting) {
            if (window[key] !== undefined) {
                netflixGlobals[key] = {
                    type: typeof window[key],
                    keys: typeof window[key] === 'object' ? Object.keys(window[key]).slice(0, 15) : undefined
                };
            }
        }
        return netflixGlobals;
    })();

    // ── 19. MUTATION TARGETS — Dynamic content areas ──────────────────

    report.mutationTargets = (() => {
        return {
            mainContent: !!document.querySelector('.mainView, [data-uia="main-view"]'),
            galleryContent: !!document.querySelector('.galleryContent, [data-uia="gallery-content"]'),
            lolomoContainer: !!document.querySelector('.lolomoRow, [data-uia="lolomo-container"]'),
            playerContainer: !!document.querySelector('.watch-video, [data-uia="player"]'),
            searchResults: !!document.querySelector('[data-uia="search-results"]'),
            jawbone: !!document.querySelector('.jawBone, .jawBoneContainer'),
            previewModal: !!document.querySelector('.previewModal--container'),
            note: 'These are areas where MutationObserver can detect changes'
        };
    })();

    // ── 20. POSSIBLE FEATURES MATRIX ──────────────────────────────────

    report.featureMatrix = (() => {
        const hasPlayer = !!safe(() => window.netflix?.player);
        const hasCache = !!safe(() => window.netflix?.falcorCache);
        const hasVideo = !!document.querySelector('video');
        const hasBrowse = window.location.pathname.includes('/browse');
        const hasProfiles = !!safe(() => window.netflix?.reactContext?.models?.activeProfile);

        return {
            'IMDb/RT Ratings Overlay':       { feasible: true,  requires: 'external API (OMDb/TMDB) + video IDs from cache', dataSources: ['falcorCache.videos', 'title-card videoId'] },
            'Enhanced Subtitle Styling':      { feasible: hasVideo, requires: 'video.textTracks API + custom CSS overlay', dataSources: ['video.textTracks'] },
            'Picture-in-Picture':             { feasible: document.pictureInPictureEnabled, requires: 'video.requestPictureInPicture()', dataSources: ['video element'] },
            'Playback Speed Memory':          { feasible: true,  requires: 'localStorage per videoId + player.setPlaybackRate', dataSources: ['player API', 'localStorage'] },
            'Audio Track Quick Switch':       { feasible: hasPlayer, requires: 'player.getAudioTrackList() + setAudioTrack()', dataSources: ['player API'] },
            'Subtitle Track Quick Switch':    { feasible: hasPlayer, requires: 'player.getTextTrackList() + setTextTrack()', dataSources: ['player API'] },
            'Video Quality Override':         { feasible: hasPlayer, requires: 'player.setMaxBitrate() or similar', dataSources: ['player API'] },
            'Watch Statistics Dashboard':     { feasible: true,  requires: 'track viewing time in localStorage, aggregate in UI', dataSources: ['localStorage', 'player currentTime'] },
            'Custom Keyboard Shortcuts':      { feasible: true,  requires: 'keydown event listener + configurable bindings', dataSources: ['keyboard events'] },
            'Row Filtering/Hiding':           { feasible: hasBrowse, requires: 'CSS display:none on .lolomoRow by context', dataSources: ['DOM .lolomoRow', 'row-header-title'] },
            'Hidden Genre Browser':           { feasible: hasCache, requires: 'genre IDs from cache → /browse/genre/{id} links', dataSources: ['falcorCache.genres'] },
            'Spoiler-Free Mode':              { feasible: hasBrowse, requires: 'blur/hide .synopsis, episode thumbnails, descriptions', dataSources: ['DOM'] },
            'Title Card Tooltips':            { feasible: hasCache, requires: 'synopsis, cast, year from falcorCache on hover', dataSources: ['falcorCache.videos.summary'] },
            'Continue Watching Cleanup':      { feasible: hasBrowse, requires: 'hide cards in CW row + remember in localStorage', dataSources: ['DOM', 'localStorage'] },
            'Random Episode Picker':          { feasible: hasCache, requires: 'seasons/episodes from cache → random selection → navigate', dataSources: ['falcorCache.seasons', 'falcorCache.episodes'] },
            'Share Current Moment':           { feasible: hasVideo, requires: 'generate URL with timestamp, copy to clipboard', dataSources: ['player currentTime', 'navigator.clipboard'] },
            'Sleep Timer':                    { feasible: hasVideo, requires: 'countdown timer → player.pause()', dataSources: ['player API', 'setTimeout'] },
            'Episode Progress Overview':      { feasible: hasCache, requires: 'bookmarkPosition per episode from cache', dataSources: ['falcorCache.videos.bookmarkPosition'] },
            'Binge Mode (auto-skip recap+intro)': { feasible: hasVideo, requires: 'detect skip buttons → auto-click', dataSources: ['MutationObserver', 'DOM buttons'] },
            'Export Watch History':           { feasible: hasCache, requires: 'iterate falcorCache bookmarks → CSV/JSON download', dataSources: ['falcorCache'] },
            'Notification When Episode Ends': { feasible: true,  requires: 'Notification API + player duration tracking', dataSources: ['Notification API', 'player API'] },
            'Mini Player (floating)':         { feasible: hasVideo, requires: 'clone video to fixed position div', dataSources: ['video element', 'CSS'] },
            'Ambient Light Effect':           { feasible: hasVideo, requires: 'canvas getImageData from video → glow border', dataSources: ['video element', 'canvas API'] },
            'Profile-Specific Settings':      { feasible: hasProfiles, requires: 'localStorage key per profile GUID', dataSources: ['reactContext.models.activeProfile.guid'] }
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
        rowCount: report.domSurfaces.rowContexts?.length || 0,
        feasibleFeatures: Object.entries(report.featureMatrix).filter(([, v]) => v.feasible).length,
        totalFeatures: Object.keys(report.featureMatrix).length
    };

    // Output — handle circular references
    const seen = new WeakSet();
    const json = JSON.stringify(report, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    }, 2);
    copy(json);
    console.log('%c[Netflix Capability Audit]', 'color: #7c3aed; font-weight: bold; font-size: 14px', 'Full report copied to clipboard!');
    console.log(`📊 ${report._summary.feasibleFeatures}/${report._summary.totalFeatures} features feasible on this page`);
    console.log(report);
    return 'Copied to clipboard!';
})();
