# TuzzAI Chrome Extension

TuzzAI is a Chrome extension that helps students understand homework questions without providing direct answers. It uses the Gemini API to analyze homework content and provide helpful explanations and hints.

## Features

-   Analyze homework questions and identify key concepts
-   Provide explanations without giving direct answers
-   Offer hints that guide students toward solutions
-   Highlight text for specific questions
-   Interactive chat interface for asking questions

## Setup Instructions

### For Developers

1. Clone the repository
2. Install dependencies:

    ```
    npm install
    ```

3. Build the extension:

    ```
    npm run build
    ```

4. Load the extension in Chrome:
    - Open Chrome and go to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked" and select the `dist` folder

### For Users

1. Install the extension from the Chrome Web Store (when available)
2. Click the TuzzAI icon in your browser toolbar
3. Start asking questions about your homework!

## Development

-   `npm run dev` - Build the extension in development mode with watch
-   `npm run build` - Build the extension for production
-   `npm run lint` - Run ESLint
-   `npm run type-check` - Run TypeScript type checking

## Architecture

The extension consists of the following components:

-   **Popup**: The user interface for interacting with TuzzAI
-   **Content Script**: Analyzes the current page content
-   **Background Script**: Handles authentication and data processing
-   **API Service**: Communicates with the Gemini API

## API Usage

The extension uses the following APIs:

-   **Gemini API**: For analyzing homework content and generating responses
-   **EducaThor Hub**: For authentication (optional)

## API Key Setup

To set up the Gemini API key:

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key if you don't have one
3. Copy the API key
4. Open `src/config/keys.ts` in your project
5. Replace `YOUR_GEMINI_API_KEY_HERE` with your actual API key
6. Rebuild the extension with `npm run build`

The API key is stored in the code and not exposed to users. They don't need to enter any API keys to use the extension.

## License

MIT
