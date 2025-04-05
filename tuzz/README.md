# TuzzAI Chrome Extension

A Chrome Extension for TuzzAI in the EducaThor suite.

## Setup Instructions

1. Install dependencies:

   ```
   npm install
   ```

2. Create icon files:

   - Open `public/manual-icons.html` in your browser
   - Follow the instructions to download the icon files
   - Place the downloaded icons in the `public/icons` directory

3. Build the extension:
   ```
   npm run build
   ```

## Testing the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `dist` directory from this project
4. The extension should now be installed and visible in your Chrome toolbar

## Development

To start development with hot-reloading:

```
npm run dev
```

This will watch for changes and rebuild the extension automatically.

## Troubleshooting

If you encounter issues loading the extension:

1. Make sure all icon files exist in the `public/icons` directory
2. Check that the manifest.json file is correctly referencing the icon paths
3. Verify that the popup/index.html file exists in the public directory
4. After making changes, rebuild the extension with `npm run build`
