// src/content/contentScript.ts

// Content script for TuzzAI extension
// This script runs on the page and extracts content for analysis

// Function to extract text content from the page
function extractPageContent(): string {
  // Get the main content of the page
  const mainContent = document.body.innerText;

  // Try to identify homework questions or educational content
  // This is a simple implementation that can be enhanced
  const paragraphs = Array.from(
    document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")
  )
    .map((element) => element.textContent)
    .filter((text) => text && text.trim().length > 0)
    .join("\n\n");

  return paragraphs || mainContent;
}

// Function to identify potential homework questions
function identifyHomeworkQuestions(): string[] {
  const questions: string[] = [];

  // Look for common question patterns
  const questionPatterns = [
    /\?$/,
    /^[0-9]+\./,
    /^[a-z]\)/,
    /^[A-Z]\)/,
    /^Question:/i,
    /^Problem:/i,
    /^Exercise:/i,
  ];

  // Check paragraphs for question patterns
  const paragraphs = Array.from(
    document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")
  );

  paragraphs.forEach((element) => {
    const text = element.textContent || "";
    if (text.trim().length > 0) {
      // Check if the text matches any question pattern
      const isQuestion = questionPatterns.some((pattern) =>
        pattern.test(text.trim())
      );
      if (isQuestion) {
        questions.push(text.trim());
      }
    }
  });

  return questions;
}

// Function to take a screenshot of the current page
async function captureScreenshot(): Promise<string> {
  // This function would use chrome.tabs.captureVisibleTab
  // But content scripts can't directly call this API
  // Instead, we'll send a message to the background script
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (response) => {
      if (response && response.dataUrl) {
        resolve(response.dataUrl);
      } else {
        resolve("");
      }
    });
  });
}

// Initialize the content script
function initialize() {
  // Extract page content
  const pageContent = extractPageContent();

  // Identify homework questions
  const questions = identifyHomeworkQuestions();

  // Store the extracted data
  const pageData = {
    url: window.location.href,
    title: document.title,
    content: pageContent,
    questions: questions,
    timestamp: Date.now(),
  };

  // Send the data to the background script
  chrome.runtime.sendMessage({
    type: "PAGE_ANALYZED",
    data: pageData,
  });

  // Listen for messages from the popup or background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_PAGE_CONTENT") {
      sendResponse({
        content: pageContent,
        questions: questions,
      });
    }

    if (message.type === "CAPTURE_SCREENSHOT") {
      captureScreenshot().then((dataUrl) => {
        sendResponse({ dataUrl });
      });
      return true; // Indicates we'll send a response asynchronously
    }
  });
}

// Run the initialization when the content script loads
initialize();

// Also run when the page content changes (for single-page applications)
const observer = new MutationObserver(() => {
  // Debounce the analysis to avoid excessive processing
  clearTimeout((window as any).tuzzaiAnalysisTimeout);
  (window as any).tuzzaiAnalysisTimeout = setTimeout(() => {
    initialize();
  }, 1000);
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log("TuzzAI content script loaded.");

export {};
