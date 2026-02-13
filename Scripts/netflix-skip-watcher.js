/**
 * Netflix Skip Button Watcher
 *
 * Monitors the DOM in real-time for any skip/next-episode elements.
 * Run this, then play a show episode from the beginning and wait
 * for the intro/recap/credits to trigger.
 *
 * It will log EVERYTHING that looks like a skip button.
 */
(function() {
    console.clear();
    console.log('%c SKIP BUTTON WATCHER — Monitoring...', 'color: #e50914; font-size: 16px; font-weight: bold');
    console.log('%c Play an episode and wait for skip/intro/recap/credits', 'color: #a78bfa');

    var found = [];

    // Known selectors to watch
    var selectors = [
        '[data-uia="player-skip-intro"]',
        '[data-uia="player-skip-recap"]',
        '[data-uia="next-episode-seamless-button"]',
        '[data-uia="player-skip-preplay"]',
        '[data-uia*="skip"]',
        '[data-uia*="next"]',
        '[class*="skip"]',
        '[class*="Skip"]',
        '[class*="next-episode"]',
        '[class*="seamless"]',
        '[class*="postplay"]',
        '[class*="interstitial"]',
        'button[class*="watch-video"]',
    ];

    function scan() {
        selectors.forEach(function(sel) {
            try {
                var els = document.querySelectorAll(sel);
                els.forEach(function(el) {
                    var id = el.getAttribute('data-uia') || el.className || el.id || el.tagName;
                    var key = sel + '|' + id;
                    if (found.indexOf(key) === -1) {
                        found.push(key);
                        var rect = el.getBoundingClientRect();
                        console.log('%c FOUND: ' + sel, 'color: #46d369; font-weight: bold; font-size: 14px');
                        console.log({
                            selector: sel,
                            tag: el.tagName.toLowerCase(),
                            dataUia: el.getAttribute('data-uia'),
                            className: (el.className || '').slice(0, 120),
                            text: (el.textContent || '').trim().slice(0, 80),
                            ariaLabel: el.getAttribute('aria-label'),
                            visible: rect.width > 0 && rect.height > 0,
                            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                            html: el.outerHTML.slice(0, 300),
                        });
                    }
                });
            } catch(e) {}
        });

        // Also search for any button with skip-related text
        document.querySelectorAll('button, [role="button"]').forEach(function(el) {
            var text = (el.textContent || '').toLowerCase();
            var label = (el.getAttribute('aria-label') || '').toLowerCase();
            var uia = (el.getAttribute('data-uia') || '').toLowerCase();
            if (text.match(/skip|intro|recap|next episode|watch next|credits/) ||
                label.match(/skip|intro|recap|next episode|watch next|credits/) ||
                uia.match(/skip|intro|recap|next|credits/)) {
                var key = 'text|' + (el.getAttribute('data-uia') || el.textContent.trim().slice(0, 30));
                if (found.indexOf(key) === -1) {
                    found.push(key);
                    var rect = el.getBoundingClientRect();
                    console.log('%c FOUND BY TEXT: ' + (el.textContent || '').trim().slice(0, 50), 'color: #fca5a5; font-weight: bold; font-size: 14px');
                    console.log({
                        tag: el.tagName.toLowerCase(),
                        dataUia: el.getAttribute('data-uia'),
                        className: (el.className || '').slice(0, 120),
                        text: (el.textContent || '').trim().slice(0, 80),
                        ariaLabel: el.getAttribute('aria-label'),
                        visible: rect.width > 0 && rect.height > 0,
                        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                        html: el.outerHTML.slice(0, 300),
                    });
                }
            }
        });
    }

    // Run on every DOM mutation
    var obs = new MutationObserver(function() { scan(); });
    obs.observe(document.body, { childList: true, subtree: true });

    // Also poll every 500ms as backup
    var interval = setInterval(scan, 500);

    // Stop after 5 minutes
    setTimeout(function() {
        obs.disconnect();
        clearInterval(interval);
        console.log('%c WATCHER STOPPED (5 min timeout)', 'color: #fca5a5; font-size: 14px; font-weight: bold');
        console.log('Found ' + found.length + ' skip-related elements total');
        window.__skipWatch = found;
    }, 300000);

    // Manual stop
    window.__stopSkipWatch = function() {
        obs.disconnect();
        clearInterval(interval);
        console.log('%c WATCHER STOPPED manually', 'color: #fca5a5');
        window.__skipWatch = found;
    };

    console.log('%c Run window.__stopSkipWatch() to stop early', 'color: #888');
})();
