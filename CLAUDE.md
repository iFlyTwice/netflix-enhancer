# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Netflix Enhancer is a **Tampermonkey userscript** that enhances the Netflix browsing/viewing experience. It runs directly on netflix.com via Tampermonkey's sandbox and uses React (loaded via CDN) for the settings UI.

**There is no build system, no package.json, no bundler.** The codebase is two plain JavaScript files plus diagnostic scripts.

## File Structure

- `netflix-enhancer.user.js` — Bootstrap loader with Tampermonkey metadata block. Fetches the latest core from GitHub (commit SHA → raw fallback → jsdelivr CDN) and executes it. This file is what users install in Tampermonkey.
- `netflix-enhancer-core.js` — The entire application (~2000 lines). Contains all managers, React components, and styles in a single IIFE.
- `Scripts/` — Diagnostic utilities meant to be pasted into the browser console at netflix.com (DOM inspector, capability audit, ratings debugger, full diagnostic).

## Development Workflow

There is no build or test command. Development is:
1. Edit `netflix-enhancer-core.js` (or the loader)
2. Push to `main` branch — the bootstrap loader auto-fetches the latest commit
3. Refresh Netflix in browser to test
4. Debug via browser console — all logs are prefixed with `[Netflix Enhancer Pro]`

Diagnostic scripts in `Scripts/` are standalone — paste them into the browser console at netflix.com.

## Architecture

The core file follows a class-based manager pattern, all instantiated by `NetflixEnhancer` (the orchestrator):

| Manager | Responsibility |
|---------|---------------|
| `ConfigManager` | Proxy-based reactive config with localStorage persistence (`netflix_enhancer_config`) |
| `RatingsManager` | Fetches ratings from OMDB API → TMDB API fallback; caches in localStorage for 7 days with request deduplication |
| `WatchlistManager` | Continue Watching list stored in localStorage (`netflix_enhancer_watchlist`) |
| `AutoSkipManager` | Detects and auto-clicks skip intro/recap/credits buttons via MutationObserver |
| `VideoController` | Keyboard shortcuts for playback (S=speed toggle, R=rewind, F=forward) |
| `TitleCardEnhancer` | Injects rating badges, progress bars, and watchlist buttons into Netflix title cards via MutationObserver |
| `ToastManager` | In-page notification system |
| `SettingsPanel` | React component (using `React.createElement`, no JSX) rendered into an injected container |
| `FloatingButton` | Persistent floating button that toggles the settings panel |

## Key Conventions

- **CSS class prefix**: `ne-` (e.g., `.ne-rating-badge`, `.ne-watchlist-btn`)
- **Data attributes**: `data-ne-enhanced`, `data-ne-video-id` to mark processed DOM elements
- **Icons**: Inline Lucide-style SVGs defined in the `ICONS` object (stroke-based, 24x24 viewBox)
- **React without JSX**: All React components use `React.createElement` directly
- **Netflix internals**: Accesses `window.netflix.falcorCache` for video metadata and `window.netflix.reactContext` for app state; title IDs extracted from `.ptrack-content[data-ui-tracking-context]` attributes
- **API keys**: OMDB and TMDB API keys are embedded in the core file (public/free-tier keys)

## External Dependencies

Loaded via Tampermonkey `@require` (not npm):
- React 18.2.0 and ReactDOM 18.2.0 from unpkg.com
- Tampermonkey APIs: `GM_addStyle`, `GM_xmlhttpRequest`

## Important Notes

- Netflix frequently changes its DOM structure; selectors may break and need updating
- The bootstrap loader uses `eval()` to execute fetched core code — this is intentional for the auto-update mechanism
- All persistent state lives in localStorage (config, watchlist, ratings cache)
- The core file version is tracked in `CORE_VERSION` constant at the top of `netflix-enhancer-core.js`
