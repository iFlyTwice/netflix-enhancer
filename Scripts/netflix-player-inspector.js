/**
 * Netflix Player Page Inspector
 *
 * Paste this into the browser console on a Netflix /watch/* page
 * to discover every hookable API, DOM element, media capability,
 * and event surface available for the Netflix Enhancer.
 *
 * Usage: Play any title → F12 → Console → Paste & Enter
 */

(function NetflixPlayerInspector() {
    'use strict';

    if (!location.pathname.startsWith('/watch')) {
        console.warn('[Player Inspector] Not on a /watch page — navigate to a video first.');
        return;
    }

    const report = {};

    // ── Helpers ──────────────────────────────────────────────────────

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
    function unique(arr) { return [...new Set(arr)]; }
    function truncate(str, len = 150) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }
    function safeProp(obj, path) {
        try { return path.split('.').reduce((o, k) => o[k], obj); } catch { return undefined; }
    }

    // ── 1. Page & Title Context ──────────────────────────────────────

    const videoId = location.pathname.match(/\/watch\/(\d+)/)?.[1] || null;
    report.context = {
        url: location.href,
        videoId,
        trackIdParam: new URLSearchParams(location.search).get('trackId'),
        tctx: new URLSearchParams(location.search).get('tctx'),
        timestamp: new Date().toISOString()
    };

    // ── 2. Video Element Deep Dive ───────────────────────────────────

    const video = $('video');
    if (video) {
        report.videoElement = {
            src: truncate(video.src),
            currentSrc: truncate(video.currentSrc),
            currentTime: video.currentTime,
            duration: video.duration,
            paused: video.paused,
            playbackRate: video.playbackRate,
            defaultPlaybackRate: video.defaultPlaybackRate,
            volume: video.volume,
            muted: video.muted,
            readyState: video.readyState,
            networkState: video.networkState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            resolution: `${video.videoWidth}x${video.videoHeight}`,
            buffered: (() => {
                const ranges = [];
                for (let i = 0; i < video.buffered.length; i++) {
                    ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
                }
                return ranges;
            })(),
            played: (() => {
                const ranges = [];
                for (let i = 0; i < video.played.length; i++) {
                    ranges.push({ start: video.played.start(i), end: video.played.end(i) });
                }
                return ranges;
            })(),
            seeking: video.seeking,
            ended: video.ended,
            loop: video.loop,
            crossOrigin: video.crossOrigin,
            preload: video.preload,
            poster: truncate(video.poster),
            disablePictureInPicture: video.disablePictureInPicture,
            pictureInPictureEnabled: document.pictureInPictureEnabled,
            isInPiP: document.pictureInPictureElement === video,
            webkitPresentationMode: video.webkitPresentationMode || null,
        };

        // Media capabilities
        report.videoElement.canPlayTypes = {
            'video/mp4': video.canPlayType('video/mp4'),
            'video/webm': video.canPlayType('video/webm'),
            'video/webm; codecs="vp9"': video.canPlayType('video/webm; codecs="vp9"'),
            'video/mp4; codecs="avc1.640028"': video.canPlayType('video/mp4; codecs="avc1.640028"'),
            'video/mp4; codecs="hev1.1.6.L93"': video.canPlayType('video/mp4; codecs="hev1.1.6.L93"'),
            'video/mp4; codecs="av01.0.05M.08"': video.canPlayType('video/mp4; codecs="av01.0.05M.08"'),
        };
    } else {
        report.videoElement = { error: 'No <video> element found' };
    }

    // ── 3. Text Tracks (Subtitles / Captions) ────────────────────────

    if (video) {
        const tracks = Array.from(video.textTracks || []);
        report.textTracks = {
            count: tracks.length,
            tracks: tracks.map(t => ({
                kind: t.kind,
                label: t.label,
                language: t.language,
                mode: t.mode,
                cueCount: t.cues ? t.cues.length : 0,
                id: t.id || null
            }))
        };

        // Also check for Netflix's custom subtitle rendering
        const subtitleContainer = $('[data-uia="subtitles-text"]') || $('.player-timedtext');
        report.textTracks.netflixSubtitleElement = {
            found: !!subtitleContainer,
            selector: subtitleContainer ? (
                subtitleContainer.getAttribute('data-uia') ? `[data-uia="${subtitleContainer.getAttribute('data-uia')}"]` : `.${subtitleContainer.className.split(' ')[0]}`
            ) : null,
            currentText: subtitleContainer ? subtitleContainer.textContent.trim() : null,
            childCount: subtitleContainer ? subtitleContainer.children.length : 0,
            styles: subtitleContainer ? {
                fontSize: getComputedStyle(subtitleContainer).fontSize,
                color: getComputedStyle(subtitleContainer).color,
                position: getComputedStyle(subtitleContainer).position,
            } : null,
            note: 'Netflix renders subtitles as styled divs, not native <track> cues'
        };
    }

    // ── 4. Audio Tracks ──────────────────────────────────────────────

    if (video && video.audioTracks) {
        const audioTracks = Array.from(video.audioTracks);
        report.audioTracks = {
            count: audioTracks.length,
            tracks: audioTracks.map(t => ({
                id: t.id,
                kind: t.kind,
                label: t.label,
                language: t.language,
                enabled: t.enabled
            }))
        };
    } else {
        report.audioTracks = { note: 'AudioTracks API not available (browser may not support it)' };
    }

    // ── 5. Player Controls DOM ───────────────────────────────────────

    const controlSelectors = {
        // Top bar
        'back-button':        '[data-uia="control-back"]',
        'title-display':      '[data-uia="video-title"]',
        // Bottom bar
        'play-pause':         '[data-uia="control-play-pause"], button[aria-label*="Play"], button[aria-label*="Pause"]',
        'back-10':            '[data-uia="control-back10"]',
        'forward-10':         '[data-uia="control-forward10"]',
        'volume':             '[data-uia="control-volume"], [data-uia="control-volume-high"], [data-uia="control-volume-medium"], [data-uia="control-volume-low"], [data-uia="control-volume-off"]',
        'speed':              '[data-uia="control-speed"]',
        'audio-subtitle':     '[data-uia="control-audio-subtitle"]',
        'episodes':           '[data-uia="control-episodes"]',
        'fullscreen':         '[data-uia="control-fullscreen-enter"], [data-uia="control-fullscreen-exit"]',
        'next-episode':       '[data-uia="control-next"]',
        'scrubber':           '[data-uia="timeline"]',
        'scrubber-thumb':     '[data-uia="timeline-knob"]',
        'scrubber-bar':       '[data-uia="timeline-bar"]',
        // Skip buttons
        'skip-intro':         '[data-uia="player-skip-intro"]',
        'skip-recap':         '[data-uia="player-skip-recap"]',
        'skip-credits':       '[data-uia="next-episode-seamless-button"]',
        'skip-preplay':       '[data-uia="player-skip-preplay"]',
        // Containers
        'controls-layout':    '.watch-video--bottom-controls-container',
        'player-container':   '.watch-video, .nf-player-container, [data-uia="video-canvas"]',
    };

    report.playerControls = {};
    for (const [name, sel] of Object.entries(controlSelectors)) {
        const el = $(sel);
        report.playerControls[name] = {
            found: !!el,
            selector: sel,
            tag: el ? el.tagName.toLowerCase() : null,
            ariaLabel: el ? el.getAttribute('aria-label') : null,
            text: el ? truncate(el.textContent.trim(), 60) : null,
            visible: el ? (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })() : false,
            rect: el ? (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
        };
    }

    // ── 6. All data-uia Values on Player Page ────────────────────────

    report.allDataUia = $$('[data-uia]').map(el => ({
        value: el.getAttribute('data-uia'),
        tag: el.tagName.toLowerCase(),
        visible: (() => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
        ariaLabel: el.getAttribute('aria-label') || null,
    }));

    report.allDataUiaValues = unique(report.allDataUia.map(x => x.value)).sort();

    // ── 7. Netflix Cadmium / Internal Player API ─────────────────────

    report.netflixAPIs = {
        'window.netflix': typeof window.netflix !== 'undefined',
        keys: typeof window.netflix === 'object' ? Object.keys(window.netflix) : [],
    };

    if (typeof window.netflix === 'object') {
        // Probe known sub-objects
        const probes = [
            'appContext', 'reactContext', 'falcorCache', 'player',
            'cadmium', 'playerApp', 'eventBus'
        ];
        for (const key of probes) {
            const val = window.netflix[key];
            report.netflixAPIs[`netflix.${key}`] = val ? {
                type: typeof val,
                keys: typeof val === 'object' ? Object.keys(val).slice(0, 30) : null,
            } : false;
        }
    }

    // Cadmium player — Netflix's internal video player wrapper
    const cadmiumPlayer = safeProp(window, 'netflix.player') ||
                          safeProp(window, 'netflix.cadmium');
    if (cadmiumPlayer) {
        const playerKeys = Object.keys(cadmiumPlayer);
        report.cadmiumPlayer = {
            found: true,
            topLevelKeys: playerKeys.slice(0, 40),
            methods: playerKeys.filter(k => typeof cadmiumPlayer[k] === 'function').slice(0, 30),
            note: 'These methods may allow programmatic playback control, quality switching, etc.'
        };
    } else {
        report.cadmiumPlayer = { found: false, note: 'No netflix.player or netflix.cadmium found' };
    }

    // Try to find the player API via the video player session
    try {
        const videoPlayer = safeProp(window, 'netflix.appContext.state.playerApp.getAPI().videoPlayer');
        if (videoPlayer) {
            const sessions = videoPlayer.getAllPlayerSessionIds ? videoPlayer.getAllPlayerSessionIds() : [];
            report.videoPlayerAPI = {
                found: true,
                sessionIds: sessions,
                methods: Object.getOwnPropertyNames(Object.getPrototypeOf(videoPlayer))
                    .filter(k => typeof videoPlayer[k] === 'function').slice(0, 30),
            };

            if (sessions.length > 0) {
                const session = videoPlayer.getVideoPlayerBySessionId(sessions[sessions.length - 1]);
                if (session) {
                    report.videoPlayerAPI.sessionMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(session))
                        .filter(k => typeof session[k] === 'function').sort();
                    // Try to read current state
                    try {
                        report.videoPlayerAPI.currentState = {
                            currentTime: session.getCurrentTime?.(),
                            duration: session.getDuration?.(),
                            playbackRate: session.getPlaybackRate?.(),
                            isPlaying: session.isPlaying?.(),
                            isPaused: session.isPaused?.(),
                            isBuffering: session.isBuffering?.(),
                            volume: session.getVolume?.(),
                            isMuted: session.isMuted?.(),
                        };
                    } catch {}
                    try {
                        const textTrackList = session.getTextTrackList?.();
                        if (textTrackList) {
                            report.videoPlayerAPI.textTracks = textTrackList.map?.(t => ({
                                displayName: t.displayName,
                                bcp47: t.bcp47,
                                isNone: t.isNoneTrack,
                                trackId: t.trackId,
                            })) || textTrackList;
                        }
                    } catch {}
                    try {
                        const audioTrackList = session.getAudioTrackList?.();
                        if (audioTrackList) {
                            report.videoPlayerAPI.audioTracksList = audioTrackList.map?.(t => ({
                                displayName: t.displayName,
                                bcp47: t.bcp47,
                                trackId: t.trackId,
                            })) || audioTrackList;
                        }
                    } catch {}
                }
            }
        }
    } catch (e) {
        report.videoPlayerAPI = { found: false, error: e.message };
    }

    // ── 8. Falcor Cache — Title Metadata ─────────────────────────────

    const cache = safeProp(window, 'netflix.falcorCache');
    if (cache && videoId) {
        const videoData = cache.videos?.[videoId];
        if (videoData) {
            const extract = (obj) => {
                if (!obj) return null;
                if (obj.value !== undefined) return obj.value;
                if (typeof obj === 'object' && !Array.isArray(obj)) {
                    const out = {};
                    for (const [k, v] of Object.entries(obj)) {
                        if (k.startsWith('$')) continue;
                        out[k] = v?.value !== undefined ? v.value : (typeof v === 'object' ? '{...}' : v);
                    }
                    return out;
                }
                return obj;
            };

            report.falcorMetadata = {
                videoId,
                availableKeys: Object.keys(videoData).slice(0, 50),
                title: extract(videoData.title),
                synopsis: truncate(extract(videoData.synopsis)?.toString(), 200),
                type: extract(videoData.type),
                releaseYear: extract(videoData.releaseYear),
                runtime: extract(videoData.runtime),
                maturity: extract(videoData.maturity),
                userRating: extract(videoData.userRating),
                averageRating: extract(videoData.averageRating),
                numSeasons: extract(videoData.seasonCount),
                episodeCount: extract(videoData.episodeCount),
                note: 'More fields available — check window.netflix.falcorCache.videos[videoId]'
            };
        } else {
            report.falcorMetadata = { videoId, note: 'Video ID not found in falcorCache.videos' };
        }

        // Check what top-level keys are in the cache
        report.falcorCacheKeys = Object.keys(cache).slice(0, 30);
    }

    // ── 9. Playback Speed Capabilities ───────────────────────────────

    report.speedControl = {
        nativeSpeedUI: !!$('[data-uia="control-speed"]'),
        currentRate: video ? video.playbackRate : null,
        settable: (() => {
            if (!video) return false;
            const original = video.playbackRate;
            try {
                video.playbackRate = 1.5;
                const ok = video.playbackRate === 1.5;
                video.playbackRate = original;
                return ok;
            } catch {
                return false;
            }
        })(),
        note: 'Netflix may reset playbackRate via their player API — may need to re-apply on seek/buffer events'
    };

    // ── 10. Picture-in-Picture ────────────────────────────────────────

    report.pip = {
        apiSupported: !!document.pictureInPictureEnabled,
        videoDisablesPiP: video ? video.disablePictureInPicture : null,
        currentlyInPiP: !!document.pictureInPictureElement,
        safariPiP: !!video?.webkitSupportsPresentationMode?.('picture-in-picture'),
        note: video?.disablePictureInPicture
            ? 'Video has disablePictureInPicture set — may need to remove attribute first'
            : 'PiP should work if browser supports it'
    };

    // ── 11. Keyboard Event Listeners ─────────────────────────────────

    // We can't enumerate existing listeners, but we can note what keys
    // Netflix already binds by checking the player's known shortcuts
    report.knownNetflixShortcuts = {
        space: 'Play/Pause',
        enter: 'Play/Pause',
        f: 'Fullscreen toggle',
        m: 'Mute toggle',
        up: 'Volume up',
        down: 'Volume down',
        left: 'Rewind 10s',
        right: 'Forward 10s',
        escape: 'Exit fullscreen / close panel',
        s: 'NOT bound by Netflix (used by enhancer for speed)',
        r: 'NOT bound by Netflix (used by enhancer for rewind)',
        note: 'Enhancer should use keys Netflix does not claim, or check e.target to avoid conflicts'
    };

    // ── 12. DRM & MediaSource ────────────────────────────────────────

    report.drm = {
        eme: typeof navigator.requestMediaKeySystemAccess === 'function',
        widevine: null,
        playready: null,
        mediaSource: typeof MediaSource !== 'undefined',
        managedMediaSource: typeof ManagedMediaSource !== 'undefined',
    };

    // Async DRM check
    (async () => {
        const keySystems = [
            { name: 'widevine', id: 'com.widevine.alpha' },
            { name: 'playready', id: 'com.microsoft.playready' },
        ];
        for (const ks of keySystems) {
            try {
                await navigator.requestMediaKeySystemAccess(ks.id, [{
                    initDataTypes: ['cenc'],
                    videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.640028"' }]
                }]);
                report.drm[ks.name] = 'supported';
            } catch {
                report.drm[ks.name] = 'not available';
            }
        }
    })();

    // ── 13. DOM Mutation Targets ──────────────────────────────────────

    // These are the containers that change frequently — useful for MutationObserver targets
    report.mutationTargets = {
        videoCanvas: !!$('[data-uia="video-canvas"]'),
        playerView: !!$('.watch-video--player-view'),
        bottomControls: !!$('.watch-video--bottom-controls-container'),
        skipElements: !!$('[class*="skip"]'),
        subtitleContainer: !!$('.player-timedtext'),
        postPlayContainer: !!$('[data-uia="watch-video-postplay"]'),
        prePlayContainer: !!$('[data-uia="watch-video-preplay"]'),
        note: 'Attach MutationObserver to these containers to detect skip buttons, subtitle changes, postplay, etc.'
    };

    // ── 14. CSS Custom Properties & Theme ────────────────────────────

    const root = getComputedStyle(document.documentElement);
    const interestingVars = [
        '--color-primary', '--color-secondary', '--player-background',
        '--nf-brand-color', '--nf-path-top-z-index'
    ];
    report.cssVars = {};
    for (const v of interestingVars) {
        const val = root.getPropertyValue(v).trim();
        if (val) report.cssVars[v] = val;
    }
    if (Object.keys(report.cssVars).length === 0) {
        report.cssVars = { note: 'No known Netflix CSS custom properties found on :root' };
    }

    // ── 15. Full CSS Dump ──────────────────────────────────────────────

    report.cssDump = { stylesheetCount: 0, playerRules: [], allClasses: [], inlineStyles: [] };
    try {
        const sheets = Array.from(document.styleSheets);
        report.cssDump.stylesheetCount = sheets.length;

        // Extract rules that target player-related selectors
        const playerPatterns = /player|watch-video|nfplayer|timedtext|subtitle|skip|scrubber|timeline|controls|seekbar|progress|volume|speed|fullscreen|pip|audio-subtitle|postplay|preplay|back-to-browse|episode/i;
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules || []);
                for (const rule of rules) {
                    if (rule.selectorText && playerPatterns.test(rule.selectorText)) {
                        report.cssDump.playerRules.push({
                            selector: rule.selectorText,
                            css: rule.cssText.length > 500 ? rule.cssText.slice(0, 500) + '…' : rule.cssText,
                            source: sheet.href ? truncate(sheet.href, 80) : 'inline'
                        });
                    }
                }
            } catch {
                // cross-origin stylesheet — can't read rules
            }
        }

        // Collect all unique CSS class names used on the player page
        const allClassNames = new Set();
        $$('*').forEach(el => {
            if (el.className && typeof el.className === 'string') {
                el.className.split(/\s+/).filter(Boolean).forEach(c => allClassNames.add(c));
            }
        });
        report.cssDump.allClasses = [...allClassNames].sort();

        // Collect computed styles for key player elements
        const keyElements = {
            'video': $('video'),
            '.watch-video--player-view': $('.watch-video--player-view'),
            '.watch-video--bottom-controls-container': $('.watch-video--bottom-controls-container'),
            '.player-timedtext': $('.player-timedtext'),
            '[data-uia="video-canvas"]': $('[data-uia="video-canvas"]'),
            '[data-uia="timeline"]': $('[data-uia="timeline"]'),
        };
        report.cssDump.computedStyles = {};
        for (const [sel, el] of Object.entries(keyElements)) {
            if (!el) continue;
            const cs = getComputedStyle(el);
            report.cssDump.computedStyles[sel] = {
                position: cs.position,
                display: cs.display,
                zIndex: cs.zIndex,
                width: cs.width,
                height: cs.height,
                background: cs.background.slice(0, 100),
                color: cs.color,
                fontSize: cs.fontSize,
                fontFamily: cs.fontFamily.slice(0, 80),
                overflow: cs.overflow,
                opacity: cs.opacity,
                transform: cs.transform,
                pointerEvents: cs.pointerEvents,
            };
        }

        report.cssDump.note = `Found ${report.cssDump.playerRules.length} player-related CSS rules and ${report.cssDump.allClasses.length} unique class names on page`;
    } catch (e) {
        report.cssDump.error = e.message;
    }

    // ── 16. Content Metadata from Page DOM ───────────────────────────

    const titleEl = $('[data-uia="video-title"]');
    const episodeEl = $('[data-uia="video-title"] span');
    report.titleFromDOM = {
        full: titleEl ? titleEl.textContent.trim() : null,
        seasonEpisode: episodeEl ? episodeEl.textContent.trim() : null,
        tag: titleEl ? titleEl.tagName.toLowerCase() : null,
    };

    // ── 17. Feature Opportunities Summary ────────────────────────────

    report.opportunities = [];

    if (video) {
        report.opportunities.push({
            feature: 'Picture-in-Picture toggle',
            feasibility: video.disablePictureInPicture ? 'needs attribute removal' : 'ready',
            effort: 'low'
        });
    }
    if (report.speedControl.settable) {
        report.opportunities.push({
            feature: 'Fine-grained speed control (0.1x increments)',
            feasibility: 'ready',
            effort: 'low'
        });
    }
    report.opportunities.push({
        feature: 'Subtitle style customization',
        feasibility: report.textTracks?.netflixSubtitleElement?.found ? 'ready (CSS override)' : 'needs investigation',
        effort: 'medium'
    });
    report.opportunities.push({
        feature: 'Skip intro/recap/credits detection',
        feasibility: 'ready (MutationObserver)',
        effort: 'already implemented'
    });
    if (report.videoPlayerAPI?.found) {
        report.opportunities.push({
            feature: 'Audio track switcher UI',
            feasibility: report.videoPlayerAPI.audioTracksList ? 'ready' : 'API available, needs testing',
            effort: 'medium'
        });
        report.opportunities.push({
            feature: 'Subtitle track switcher (custom UI)',
            feasibility: report.videoPlayerAPI.textTracks ? 'ready' : 'API available, needs testing',
            effort: 'medium'
        });
    }
    if (report.falcorMetadata) {
        report.opportunities.push({
            feature: 'On-screen title/episode info overlay',
            feasibility: 'ready (falcorCache data)',
            effort: 'low'
        });
    }
    report.opportunities.push({
        feature: 'Binge timer / break reminder',
        feasibility: 'ready (track elapsed watch time)',
        effort: 'low'
    });
    report.opportunities.push({
        feature: 'Screenshot / frame capture',
        feasibility: 'blocked (DRM — canvas.drawImage will be blank)',
        effort: 'n/a'
    });
    report.opportunities.push({
        feature: 'Custom keyboard shortcuts panel',
        feasibility: 'ready',
        effort: 'medium'
    });

    // ── Output ───────────────────────────────────────────────────────

    console.clear();
    console.log('%c╔══════════════════════════════════════════════╗', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c║     Netflix Player Page Inspector            ║', 'color: #e50914; font-size: 14px; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════════╝', 'color: #e50914; font-size: 14px; font-weight: bold');

    const sections = [
        ['1. Page & Title Context', report.context],
        ['2. Video Element', report.videoElement],
        ['3. Text Tracks (Subtitles)', report.textTracks],
        ['4. Audio Tracks', report.audioTracks],
        ['5. Player Controls DOM', report.playerControls],
        ['6. All data-uia Values', report.allDataUiaValues],
        ['7. Netflix Internal APIs', report.netflixAPIs],
        ['8. Cadmium Player', report.cadmiumPlayer],
        ['9. Video Player Session API', report.videoPlayerAPI],
        ['10. Falcor Cache Metadata', report.falcorMetadata],
        ['11. Speed Control', report.speedControl],
        ['12. Picture-in-Picture', report.pip],
        ['13. Known Netflix Shortcuts', report.knownNetflixShortcuts],
        ['14. DRM & MediaSource', report.drm],
        ['15. Mutation Observer Targets', report.mutationTargets],
        ['16. CSS Custom Properties', report.cssVars],
        ['17. Full CSS Dump (player rules + classes)', report.cssDump],
        ['18. Title from DOM', report.titleFromDOM],
        ['19. Feature Opportunities', report.opportunities],
    ];

    sections.forEach(([title, data]) => {
        console.groupCollapsed(`%c${title}`, 'color: #46d369; font-weight: bold; font-size: 12px');
        try {
            console.log(JSON.parse(JSON.stringify(data, null, 2)));
        } catch {
            console.log(data);
        }
        console.groupEnd();
    });

    // Highlight opportunities
    console.log('%c\n🎯 Feature Opportunities:', 'color: #a78bfa; font-weight: bold; font-size: 13px');
    console.table(report.opportunities);

    console.log('%c\n📋 Full report stored in window.__nfxPlayerInspector', 'color: #aaa');
    window.__nfxPlayerInspector = report;

    try {
        copy(JSON.stringify(report, null, 2));
        console.log('%c📋 Copied to clipboard!', 'color: #46d369');
    } catch {
        console.log('%c(Could not auto-copy — use: copy(JSON.stringify(window.__nfxPlayerInspector, null, 2)))', 'color: #888');
    }

    return report;
})();
