/**
 * Advanced Netflix Enhancer Features
 * 
 * These are example features you can add to your Netflix Enhancer script.
 * Copy and paste the functions you want into your main script.
 */

// ============================================================================
// AUTO-SKIP INTRO (Automatically clicks skip intro button)
// ============================================================================
function autoSkipIntro() {
    const observer = new MutationObserver(() => {
        const skipButton = document.querySelector('[data-uia="player-skip-intro"]');
        if (skipButton && skipButton.offsetParent !== null) {
            console.log('Auto-clicking skip intro button');
            skipButton.click();
        }

        const skipRecap = document.querySelector('[data-uia="player-skip-recap"]');
        if (skipRecap && skipRecap.offsetParent !== null) {
            console.log('Auto-clicking skip recap button');
            skipRecap.click();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================================================
// CUSTOM SUBTITLE STYLES
// ============================================================================
function customSubtitleStyles() {
    const subtitleStyles = `
        .player-timedtext-text-container {
            font-size: 120% !important;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8) !important;
            background: rgba(0,0,0,0.6) !important;
            padding: 5px 10px !important;
            border-radius: 4px !important;
        }
    `;
    GM_addStyle(subtitleStyles);
}

// ============================================================================
// PLAYBACK SPEED CONTROLS (More options)
// ============================================================================
function addPlaybackSpeedControl() {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    let currentSpeedIndex = 2; // Default to 1x

    const speedDisplay = document.createElement('div');
    speedDisplay.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        font-family: Netflix Sans, Arial, sans-serif;
        font-size: 14px;
        z-index: 9999;
        display: none;
    `;
    speedDisplay.textContent = 'Speed: 1x';
    document.body.appendChild(speedDisplay);

    document.addEventListener('keydown', (e) => {
        const video = document.querySelector('video');
        if (!video) return;

        // Increase speed with '+'
        if (e.key === '+' || e.key === '=') {
            currentSpeedIndex = Math.min(currentSpeedIndex + 1, speeds.length - 1);
            video.playbackRate = speeds[currentSpeedIndex];
            showSpeedDisplay(speedDisplay, speeds[currentSpeedIndex]);
        }

        // Decrease speed with '-'
        if (e.key === '-' || e.key === '_') {
            currentSpeedIndex = Math.max(currentSpeedIndex - 1, 0);
            video.playbackRate = speeds[currentSpeedIndex];
            showSpeedDisplay(speedDisplay, speeds[currentSpeedIndex]);
        }
    });
}

function showSpeedDisplay(display, speed) {
    display.textContent = `Speed: ${speed}x`;
    display.style.display = 'block';
    setTimeout(() => {
        display.style.display = 'none';
    }, 2000);
}

// ============================================================================
// SCREENSHOT BUTTON
// ============================================================================
function addScreenshotButton() {
    const observer = new MutationObserver(() => {
        const playerControls = document.querySelector('.PlayerControlsNeo__layout');
        if (playerControls && !document.querySelector('.screenshot-btn')) {
            const screenshotBtn = document.createElement('button');
            screenshotBtn.className = 'screenshot-btn';
            screenshotBtn.innerHTML = '📷';
            screenshotBtn.title = 'Take Screenshot';
            screenshotBtn.style.cssText = `
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                margin: 0 5px;
            `;

            screenshotBtn.addEventListener('click', () => {
                takeScreenshot();
            });

            playerControls.appendChild(screenshotBtn);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function takeScreenshot() {
    const video = document.querySelector('video');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `netflix-screenshot-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

// ============================================================================
// EPISODE TRACKER
// ============================================================================
function addEpisodeTracker() {
    const tracker = document.createElement('div');
    tracker.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        font-family: Netflix Sans, Arial, sans-serif;
        font-size: 12px;
        z-index: 9999;
    `;

    const observer = new MutationObserver(() => {
        const titleElement = document.querySelector('.video-title');
        if (titleElement) {
            tracker.textContent = `Watching: ${titleElement.textContent}`;
            if (!tracker.parentNode) {
                document.body.appendChild(tracker);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================================================
// WATCH HISTORY SAVER
// ============================================================================
function saveWatchHistory() {
    const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        if (video && !video.hasAttribute('data-tracking')) {
            video.setAttribute('data-tracking', 'true');

            const titleElement = document.querySelector('.video-title');
            const title = titleElement ? titleElement.textContent : 'Unknown';

            setInterval(() => {
                const currentTime = Math.floor(video.currentTime);
                const duration = Math.floor(video.duration);
                const progress = Math.floor((currentTime / duration) * 100);

                const historyData = {
                    title: title,
                    currentTime: currentTime,
                    duration: duration,
                    progress: progress,
                    timestamp: new Date().toISOString()
                };

                // Save to localStorage
                const history = JSON.parse(localStorage.getItem('netflixEnhancerHistory') || '[]');
                history.unshift(historyData);
                localStorage.setItem('netflixEnhancerHistory', JSON.stringify(history.slice(0, 50)));
            }, 5000); // Save every 5 seconds
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================================================
// CUSTOM RATING OVERLAY
// ============================================================================
function addCustomRatings() {
    const observer = new MutationObserver(() => {
        const titleCards = document.querySelectorAll('.title-card');
        titleCards.forEach(card => {
            if (!card.querySelector('.custom-rating')) {
                const ratingBadge = document.createElement('div');
                ratingBadge.className = 'custom-rating';
                ratingBadge.style.cssText = `
                    position: absolute;
                    top: 5px;
                    left: 5px;
                    background: rgba(255, 193, 7, 0.9);
                    color: black;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-weight: bold;
                    font-size: 11px;
                    z-index: 10;
                `;
                ratingBadge.textContent = '⭐ Custom';
                card.style.position = 'relative';
                card.appendChild(ratingBadge);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ============================================================================
// DARK MODE TOGGLE
// ============================================================================
function addDarkModeToggle() {
    const darkModeStyles = `
        body {
            background-color: #000000 !important;
        }
        .billboard {
            background-color: #0a0a0a !important;
        }
    `;

    let darkModeEnabled = GM_getValue('darkMode', false);

    if (darkModeEnabled) {
        GM_addStyle(darkModeStyles);
    }

    // Add toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = darkModeEnabled ? '🌙' : '☀️';
    toggleBtn.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
        z-index: 9999;
    `;

    toggleBtn.addEventListener('click', () => {
        darkModeEnabled = !darkModeEnabled;
        GM_setValue('darkMode', darkModeEnabled);
        location.reload();
    });

    document.body.appendChild(toggleBtn);
}

// ============================================================================
// USAGE INSTRUCTIONS
// ============================================================================
// To use any of these features, copy the function into your main
// netflix-enhancer.user.js file and call it in the initialize() function:
//
// function initialize() {
//     // ... existing code ...
//     autoSkipIntro();           // Add this line
//     customSubtitleStyles();    // Add this line
//     addPlaybackSpeedControl(); // Add this line
//     // etc...
// }
