# TuzzAI Chrome Extension

TuzzAI is a Chrome extension that helps students understand homework questions without giving direct answers. It uses the Gemini API to analyze page content and provide helpful explanations and hints.

## Features

- **Page Analysis**: Automatically extracts and analyzes homework questions from web pages
- **Interactive Chat**: Ask questions and get helpful explanations without direct answers
- **Hint Generation**: Receive hints that guide you toward the solution
- **Screenshot Capture**: Captures the current page for context
- **Authentication**: Integrates with EducaThor Hub for user authentication

## Setup Instructions

### Prerequisites

- Google Chrome browser
- Node.js and npm installed
- A Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/tuzzai-extension.git
   cd tuzzai-extension
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Build the extension:

   ```
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder from this project

### Icon Generation

If you need to generate icons for the extension:

1. Open `public/manual-icons.html` in a browser
2. Follow the instructions to generate and download the icons
3. Place the downloaded icons in the `public/icons` directory

## Usage

1. Click the TuzzAI extension icon in your Chrome toolbar
2. Log in to the EducaThor Hub when prompted
3. Enter your Gemini API key when prompted
4. Navigate to a page with homework questions
5. Ask questions about the homework in the chat interface
6. Receive helpful explanations and hints without direct answers

## Development

- Run the development server with watch mode:

  ```
  npm run dev
  ```

- Type-check the code:

  ```
  npm run type-check
  ```

- Lint the code:
  ```
  npm run lint
  ```

## Architecture

The extension consists of the following components:

- **Background Script**: Handles authentication, data processing, and communication between components
- **Content Script**: Extracts text content from web pages and identifies homework questions
- **Popup UI**: Provides the chat interface and user interaction
- **API Service**: Communicates with the EducaThor Hub and Gemini API

## Gemini API Integration

TuzzAI uses the Gemini API for:

1. **Page Analysis**: Analyzing homework content to identify questions and key concepts
2. **Chat Responses**: Generating helpful explanations and hints for student questions

To use the extension, you need to provide your own Gemini API key. You can obtain one from the [Google AI Studio](https://makersuite.google.com/app/apikey).

## License

[MIT License](LICENSE)
