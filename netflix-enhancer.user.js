// ==UserScript==
// @name         Netflix Enhancer Pro
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Bootstrap loader for Netflix Enhancer - fetches latest core via commit SHA for instant updates
// @author       iFlyTwice
// @match        https://www.netflix.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=netflix.com
// @updateURL    https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/main/netflix-enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/main/netflix-enhancer.user.js
// @supportURL   https://github.com/iFlyTwice/netflix-enhancer/issues
// @homepageURL  https://github.com/iFlyTwice/netflix-enhancer
// @require      https://unpkg.com/react@18.2.0/umd/react.production.min.js
// @require      https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      github.com
// @connect      api.github.com
// @connect      cdn.jsdelivr.net
// @connect      raw.githubusercontent.com
// @connect      api.themoviedb.org
// @connect      www.omdbapi.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Netflix Enhancer Pro] Loader bootstrap - Fetching latest core...');
    window.__NETFLIX_ENHANCER_LOADER_VERSION = 'bootstrap';

    const REPO_API = 'https://api.github.com/repos/iFlyTwice/netflix-enhancer/commits/main';
    const FALLBACK_URL = 'https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/refs/heads/main/netflix-enhancer-core.js';
    const CDN_URL = 'https://cdn.jsdelivr.net/gh/iFlyTwice/netflix-enhancer@main/netflix-enhancer-core.js';
    const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    function extractCoreVersion(code) {
        const match = String(code).match(/const\s+CORE_VERSION\s*=\s*['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    }

    function executeCore(code, sourceName) {
        const fetchedVersion = extractCoreVersion(code);

        window.__NETFLIX_ENHANCER_CORE_SOURCE = sourceName;
        window.__NETFLIX_ENHANCER_CORE_VERSION = fetchedVersion || 'unknown';
        console.log(`[Netflix Enhancer Pro] Core ${window.__NETFLIX_ENHANCER_CORE_VERSION} loaded from ${sourceName} ✓`);
        eval(code);
    }

    // Fetch latest commit SHA from GitHub API for instant updates
    GM_xmlhttpRequest({
        method: 'GET',
        url: REPO_API,
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache, no-store, max-age=0',
            'Pragma': 'no-cache'
        },
        onload(response) {
            if (response.status === 200) {
                try {
                    const data = JSON.parse(response.responseText);
                    const sha = data.sha;
                    if (sha) {
                        console.log(`[Netflix Enhancer Pro] Latest commit: ${sha.substring(0, 7)}`);
                        loadFromCommitSha(sha);
                        return;
                    }
                } catch (error) {
                    console.warn('[Netflix Enhancer Pro] Error parsing commit data:', error);
                }
            }
            console.warn('[Netflix Enhancer Pro] GitHub API failed, using branch fallback...');
            loadFallback();
        },
        onerror() {
            console.warn('[Netflix Enhancer Pro] GitHub API unavailable, using fallback...');
            loadFallback();
        },
        timeout: 3000
    });

    function loadFromCommitSha(sha) {
        const commitUrl = `https://raw.githubusercontent.com/iFlyTwice/netflix-enhancer/${sha}/netflix-enhancer-core.js`;
        GM_xmlhttpRequest({
            method: 'GET',
            url: commitUrl,
            headers: {
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache'
            },
            onload(response) {
                if (response.status === 200) {
                    try {
                        executeCore(response.responseText, `commit-${sha.substring(0, 7)}`);
                    } catch (error) {
                        console.error('[Netflix Enhancer Pro] Error executing core:', error);
                        loadFallback();
                    }
                    return;
                }
                console.warn('[Netflix Enhancer Pro] Commit SHA fetch failed, using fallback...');
                loadFallback();
            },
            onerror() {
                console.warn('[Netflix Enhancer Pro] Commit SHA unavailable, using fallback...');
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
                        executeCore(response.responseText, 'github-raw-branch');
                    } catch (error) {
                        console.error('[Netflix Enhancer Pro] Error executing fallback core:', error);
                        loadCdn();
                    }
                    return;
                }
                console.warn('[Netflix Enhancer Pro] Branch fallback failed, trying CDN...');
                loadCdn();
            },
            onerror() {
                console.warn('[Netflix Enhancer Pro] Branch fallback unavailable, using CDN...');
                loadCdn();
            },
            timeout: 5000
        });
    }

    function loadCdn() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${CDN_URL}?v=${cacheBuster}`,
            headers: {
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache'
            },
            onload(response) {
                if (response.status === 200) {
                    try {
                        executeCore(response.responseText, 'jsdelivr-cdn');
                    } catch (error) {
                        console.error('[Netflix Enhancer Pro] Error executing CDN core:', error);
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
