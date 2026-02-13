# Netflix Enhancer - Tampermonkey Script

A powerful Tampermonkey userscript that enhances your Netflix experience with custom features and DOM improvements.

## Features

### Current Features
- 🎨 **Custom Styles** - Improved UI elements and better visual effects
- ⏭️ **Skip Intro Helper** - Highlights skip intro/recap buttons with green glow
- ⌨️ **Keyboard Shortcuts** - Additional keyboard controls for video playback
  - Press `S` to toggle playback speed (1x / 1.5x)
  - Press `R` to rewind 10 seconds
- 📺 **Enhanced Title Cards** - Improved hover effects and animations
- 🎬 **Video Player Enhancements** - Better control visibility and custom features
- 🔧 **Settings Badge** - Visual indicator that the script is active (top-right corner)

### Planned Features
- Auto-skip intros and recaps (with user control)
- Custom subtitle styling
- Download button for offline viewing info
- Custom rating system
- Watch history enhancements
- Better search functionality
- Custom themes
- And more!

## Installation

### Prerequisites
1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
   - [Chrome/Edge](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojeybbdmfdbhjhllb)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### Install the Script
1. Click on the Tampermonkey icon in your browser
2. Click "Create a new script"
3. Delete all the default content
4. Copy and paste the contents of `netflix-enhancer.user.js`
5. Press `Ctrl+S` (or `Cmd+S` on Mac) to save
6. Navigate to Netflix.com and enjoy!

### Alternative Installation
If you have the `.user.js` file locally:
1. Open Tampermonkey dashboard
2. Click on the "Utilities" tab
3. Scroll to "Import from file"
4. Select `netflix-enhancer.user.js`
5. Click "Install"

## Usage

Once installed, the script runs automatically on Netflix.com. You'll see a red badge in the top-right corner that says "🎬 Netflix Enhanced" confirming the script is active.

### Keyboard Shortcuts
- `S` - Toggle playback speed between 1x and 1.5x
- `R` - Rewind 10 seconds
- More shortcuts coming soon!

### Settings
Click on the red badge in the top-right corner to view active features (more settings UI coming soon).

## Customization

### Modifying Styles
Edit the `customStyles` constant in the script to change colors, sizes, and effects:

```javascript
const customStyles = `
    /* Add your custom CSS here */
    .netflix-enhancer-badge {
        background: rgba(229, 9, 20, 0.9);
        /* Customize colors, sizes, etc. */
    }
`;
```

### Enabling/Disabling Features
Modify the `CONFIG` object at the top of the script:

```javascript
const CONFIG = {
    enableCustomStyles: true,      // Set to false to disable custom styles
    enableSkipIntro: true,          // Set to false to disable skip intro helper
    enableAutoplayControl: true,    // Set to false to disable autoplay control
    customBackgroundColor: '#141414'
};
```

### Adding New Features
The script uses MutationObservers to watch for DOM changes. You can add new features by:

1. Creating a new function (e.g., `function myNewFeature() { ... }`)
2. Calling it in the `initialize()` function
3. Using observers to detect new elements as they appear

Example:
```javascript
function myNewFeature() {
    const observer = new MutationObserver(() => {
        // Your code to manipulate DOM elements
        const element = document.querySelector('.target-class');
        if (element) {
            // Do something with the element
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
```

## Development

### Project Structure
```
netflix-enhancer/
├── netflix-enhancer.user.js    # Main Tampermonkey script
├── README.md                    # This file
└── examples/                    # Example enhancements (optional)
```

### Testing
1. Make changes to the script in Tampermonkey editor
2. Save with `Ctrl+S` / `Cmd+S`
3. Refresh Netflix page
4. Check browser console (F12) for debug messages

### Debugging
The script logs various messages to the console:
- Open Developer Tools (F12)
- Go to Console tab
- Look for messages starting with "Netflix Enhancer:"

## Permissions

The script requires these Tampermonkey grants:
- `GM_addStyle` - To inject custom CSS
- `GM_getValue` - To read saved settings
- `GM_setValue` - To save settings
- `@match https://www.netflix.com/*` - To run on Netflix pages only

## Contributing

Feel free to modify and extend this script! Some ideas:
- Add more keyboard shortcuts
- Create a better settings UI panel
- Add custom download features
- Implement custom themes
- Add statistics tracking
- Create custom overlays

## Troubleshooting

### Script not working?
1. Check that Tampermonkey is enabled
2. Check that the script is enabled in Tampermonkey dashboard
3. Refresh the Netflix page
4. Check browser console for errors

### Netflix Changes Breaking Script?
Netflix updates their DOM structure regularly. If features break:
1. Open browser console (F12)
2. Inspect the Netflix elements
3. Update selectors in the script (e.g., `.title-card`, `[data-uia="player-skip-intro"]`)

## License

Free to use and modify for personal use.

## Disclaimer

This script is for educational and personal enhancement purposes only. It does not bypass any Netflix security measures or enable unauthorized access to content.

---

**Version:** 0.1.0  
**Last Updated:** February 2026  
**Compatibility:** Tested on Netflix.com with latest Tampermonkey
