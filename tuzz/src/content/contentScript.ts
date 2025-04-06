// src/content/contentScript.ts

import { EDUCA_THOR_HUB_URL } from "../config";

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
  return new Promise((resolve) => {
    // Get the viewport dimensions
    const viewportWidth = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0
    );
    const viewportHeight = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight || 0
    );

    console.log(
      `Capturing screenshot with viewport dimensions: ${viewportWidth}x${viewportHeight}`
    );

    chrome.runtime.sendMessage(
      {
        type: "CAPTURE_SCREENSHOT",
        dimensions: {
          width: viewportWidth,
          height: viewportHeight,
        },
      },
      (response) => {
        if (response && response.dataUrl) {
          console.log("Screenshot captured successfully");
          resolve(response.dataUrl);
        } else {
          console.error(
            "Screenshot capture failed:",
            response?.error || "Unknown error"
          );
          resolve("");
        }
      }
    );
  });
}

async function analyzePageContent(pageContent: string, screenshot: string) {
  try {
    console.log("Sending page content to backend for analysis");

    const response = await fetch(`${EDUCA_THOR_HUB_URL}/api/gemini/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("educathor-token")}`, // Use stored token
      },
      body: JSON.stringify({
        content: pageContent,
        screenshot,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend analysis error:", errorText);
      return;
    }

    const data = await response.json();
    console.log("Backend analysis response:", data);

    // Handle the analyzed data (e.g., display questions or context)
  } catch (error) {
    console.error("Error analyzing page content:", error);
  }
}

// Modify the initialization function to call the backend analysis endpoint
async function initialize() {
  const pageContent = extractPageContent();
  const screenshot = await captureScreenshot();

  // Send the extracted content and screenshot to the backend
  await analyzePageContent(pageContent, screenshot);

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

  window.addEventListener("message", (event) => {
    console.log("Received message from AuthBridge:", event.data);
    if (event.data.type === "educathor-token") {
      // Handle the token received from the AuthBridge
      const token = event.data.token;

      // Send the token to the background script
      chrome.runtime.sendMessage({
        type: "educathor-token",
        data: { token: token },
      });
    }

    if (event.data.type === "educathor-logout") {
      // Send the token to the background script
      chrome.runtime.sendMessage({
        type: "educathor-logout",
      });
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
