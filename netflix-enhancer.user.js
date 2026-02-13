// ==UserScript==
// @name         Netflix Enhancer Pro
// @namespace    http://tampermonkey.net/
// @version      4.0.4
// @description  Modern Netflix enhancement with React UI, auto-skip, custom controls, and more - INSTANT UPDATES!
// @author       iFlyTwice
// @match        https://www.netflix.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=netflix.com
// @updateURL    https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/main/netflix-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/main/netflix-enhancer.user.js
// @supportURL   https://github.com/iFlyTwice/netflix-enhancer/issues
// @homepageURL  https://github.com/iFlyTwice/netflix-enhancer
// @resource     FONTAWESOME_CSS https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css
// @require      https://unpkg.com/react@18.2.0/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Netflix Enhancer Pro] v4.0.4 Loader - Fetching latest code...');
    window.__NETFLIX_ENHANCER_LOADER_VERSION = '4.0.4';

    const CORE_URL = 'https://github.com/iFlyTwice/netflix-enhancer/releases/latest/download/netflix-enhancer-core.js';
    const SECONDARY_URL = 'https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/refs/heads/main/netflix-enhancer-core.js';
    const FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/iFlyTwice/netflix-enhancer@main/netflix-enhancer-core.js';
    const MIN_CORE_VERSION = '4.0.4';
    const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    function compareVersions(a, b) {
        const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
        const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const va = pa[i] || 0;
            const vb = pb[i] || 0;
            if (va > vb) return 1;
            if (va < vb) return -1;
        }
        return 0;
    }

    function extractCoreVersion(code) {
        const match = String(code).match(/const\s+CORE_VERSION\s*=\s*['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    }

    function executeCore(code, sourceName) {
        const fetchedVersion = extractCoreVersion(code);
        if (fetchedVersion && compareVersions(fetchedVersion, MIN_CORE_VERSION) < 0) {
            throw new Error(`Stale core detected from ${sourceName}: ${fetchedVersion} < ${MIN_CORE_VERSION}`);
        }

        window.__NETFLIX_ENHANCER_CORE_SOURCE = sourceName;
        window.__NETFLIX_ENHANCER_CORE_VERSION = fetchedVersion || 'unknown';
        console.log(`[Netflix Enhancer Pro] Core ${window.__NETFLIX_ENHANCER_CORE_VERSION} loaded from ${sourceName} ✓`);
        eval(code);
    }

    GM_xmlhttpRequest({
        method: 'GET',
        url: `${CORE_URL}?v=${cacheBuster}`,
        headers: {
            'Cache-Control': 'no-cache, no-store, max-age=0',
            'Pragma': 'no-cache'
        },
        onload(response) {
            if (response.status === 200) {
                try {
                    executeCore(response.responseText, 'github-release-latest');
                } catch (error) {
                    console.error('[Netflix Enhancer Pro] Error executing core:', error);
                    loadSecondary();
                }
                return;
            }

            console.warn('[Netflix Enhancer Pro] Primary source failed, trying secondary...');
            loadSecondary();
        },
        onerror() {
            console.warn('[Netflix Enhancer Pro] Primary source unavailable, trying secondary...');
            loadSecondary();
        },
        timeout: 5000
    });

    function loadSecondary() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${SECONDARY_URL}?v=${cacheBuster}`,
            headers: {
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache'
            },
            onload(response) {
                if (response.status === 200) {
                    try {
                        executeCore(response.responseText, 'github-raw');
                    } catch (error) {
                        console.error('[Netflix Enhancer Pro] Error executing secondary core:', error);
                        loadFallback();
                    }
                    return;
                }

                console.warn('[Netflix Enhancer Pro] Secondary source failed, trying fallback...');
                loadFallback();
            },
            onerror() {
                console.warn('[Netflix Enhancer Pro] Secondary source unavailable, using fallback...');
                loadFallback();
            },
            timeout: 5000
        });
    }

    function loadFallback() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${FALLBACK_URL}?v=${cacheBuster}`,
            headers: {
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache'
            },
            onload(response) {
                if (response.status === 200) {
                    try {
                        executeCore(response.responseText, 'jsdelivr-cdn');
                    } catch (error) {
                        console.error('[Netflix Enhancer Pro] Error executing core:', error);
                    }
                } else {
                    console.error('[Netflix Enhancer Pro] Failed to load core application');
                }
            },
            onerror() {
                console.error('[Netflix Enhancer Pro] All sources failed - please check your connection');
            },
            timeout: 10000
        });
    }
})();
