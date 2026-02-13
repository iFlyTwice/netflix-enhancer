// ==UserScript==
// @name         Netflix Enhancer
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Enhance Netflix with custom features and DOM improvements
// @author       You
// @match        https://www.netflix.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=netflix.com
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        enableCustomStyles: GM_getValue('enableCustomStyles', true),
        enableSkipIntro: GM_getValue('enableSkipIntro', true),
        enableAutoplayControl: GM_getValue('enableAutoplayControl', true),
        customBackgroundColor: GM_getValue('customBackgroundColor', '#141414')
    };

    // Custom styles for Netflix
    const customStyles = `
        /* Custom Netflix Enhancements */
        .netflix-enhancer-badge {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(229, 9, 20, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            font-family: Netflix Sans, Helvetica, Arial, sans-serif;
            font-size: 12px;
            z-index: 9999;
            transition: opacity 0.3s;
        }

        .netflix-enhancer-badge:hover {
            opacity: 0.7;
        }

        /* Example: Improve video player controls visibility */
        .watch-video--player-view .PlayerControlsNeo__layout {
            background: linear-gradient(to top, rgba(0,0,0,0.9), transparent) !important;
        }

        /* Example: Better title card hover effects */
        .title-card:hover {
            transform: scale(1.1);
            transition: transform 0.3s ease;
        }
    `;

    // Add custom styles
    function addCustomStyles() {
        if (CONFIG.enableCustomStyles) {
            GM_addStyle(customStyles);
            console.log('Netflix Enhancer: Custom styles applied');
        }
    }

    // Create a settings badge
    function createSettingsBadge() {
        const badge = document.createElement('div');
        badge.className = 'netflix-enhancer-badge';
        badge.textContent = '🎬 Netflix Enhanced';
        badge.title = 'Netflix Enhancer is active';
        
        badge.addEventListener('click', () => {
            showSettingsPanel();
        });
        
        return badge;
    }

    // Settings panel (basic example)
    function showSettingsPanel() {
        alert('Netflix Enhancer Settings\n\nFeatures active:\n' +
              '✓ Custom Styles\n' +
              '✓ Skip Intro Helper\n' +
              '✓ Autoplay Control\n\n' +
              'More features coming soon!');
    }

    // Auto-click Skip Intro button
    function setupSkipIntroHelper() {
        if (!CONFIG.enableSkipIntro) return;

        const observer = new MutationObserver(() => {
            // Look for the skip intro button
            const skipButton = document.querySelector('[data-uia="player-skip-intro"]');
            if (skipButton && skipButton.offsetParent !== null) {
                console.log('Netflix Enhancer: Skip intro button found');
                // You can auto-click it or just highlight it
                skipButton.style.border = '3px solid #00ff00';
                skipButton.style.boxShadow = '0 0 10px #00ff00';
            }

            // Look for skip recap button
            const skipRecap = document.querySelector('[data-uia="player-skip-recap"]');
            if (skipRecap && skipRecap.offsetParent !== null) {
                console.log('Netflix Enhancer: Skip recap button found');
                skipRecap.style.border = '3px solid #00ff00';
                skipRecap.style.boxShadow = '0 0 10px #00ff00';
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Netflix Enhancer: Skip intro helper activated');
    }

    // Enhance title cards
    function enhanceTitleCards() {
        const observer = new MutationObserver(() => {
            const titleCards = document.querySelectorAll('.title-card');
            titleCards.forEach(card => {
                if (!card.classList.contains('enhanced')) {
                    card.classList.add('enhanced');
                    
                    // Add custom enhancements to title cards
                    card.addEventListener('mouseenter', (e) => {
                        // Example: You can add custom info overlays here
                        console.log('Hovering over:', card.getAttribute('aria-label'));
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Netflix Enhancer: Title card enhancements activated');
    }

    // Get video element and add custom controls
    function enhanceVideoPlayer() {
        const observer = new MutationObserver(() => {
            const video = document.querySelector('video');
            if (video && !video.classList.contains('enhanced')) {
                video.classList.add('enhanced');
                console.log('Netflix Enhancer: Video player found and enhanced');
                
                // Example: Add keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    // Example: Press 'S' to speed up playback
                    if (e.key === 's' || e.key === 'S') {
                        video.playbackRate = video.playbackRate === 1 ? 1.5 : 1;
                        console.log('Playback rate:', video.playbackRate);
                    }
                    
                    // Example: Press 'R' to rewind 10 seconds
                    if (e.key === 'r' || e.key === 'R') {
                        video.currentTime -= 10;
                        console.log('Rewinded 10 seconds');
                    }
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('Netflix Enhancer: Video player enhancements activated');
    }

    // Initialize when DOM is ready
    function initialize() {
        console.log('Netflix Enhancer: Initializing...');
        
        // Add custom styles
        addCustomStyles();
        
        // Wait for body to be available
        const initWhenReady = setInterval(() => {
            if (document.body) {
                clearInterval(initWhenReady);
                
                // Add settings badge
                document.body.appendChild(createSettingsBadge());
                
                // Setup features
                setupSkipIntroHelper();
                enhanceTitleCards();
                enhanceVideoPlayer();
                
                console.log('Netflix Enhancer: Fully initialized ✓');
            }
        }, 100);
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
