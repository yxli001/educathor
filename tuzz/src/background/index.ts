// src/background/index.ts

// Background script for TuzzAI extension
// This script runs in the background and handles authentication and data processing

// Constants
const AUTH_STORAGE_KEY = "tuzzai_auth_token";
const PAGE_DATA_STORAGE_KEY = "tuzzai_page_data";

// Store for the latest analyzed page data
let latestPageData: any = null;

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle page analysis data from content script
  if (message.type === "PAGE_ANALYZED") {
    latestPageData = message.data;

    // Store the page data
    chrome.storage.local.set({ [PAGE_DATA_STORAGE_KEY]: message.data }, () => {
      console.log("Page data stored:", message.data);
    });

    sendResponse({ success: true });
  }

  // Handle screenshot capture request
  if (message.type === "CAPTURE_SCREENSHOT") {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        // Get the window ID for the current tab
        chrome.windows.getCurrent((window) => {
          if (window.id !== undefined) {
            // Capture the visible tab
            chrome.tabs.captureVisibleTab(
              window.id,
              { format: "png" },
              (dataUrl) => {
                sendResponse({ dataUrl });
              }
            );
          } else {
            sendResponse({ dataUrl: "" });
          }
        });
      } else {
        sendResponse({ dataUrl: "" });
      }
    });

    return true; // Indicates we'll send a response asynchronously
  }

  // Handle authentication success from EducaThor Hub
  if (message.type === "AUTH_SUCCESS") {
    // Store the auth token
    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: message.token }, () => {
      console.log("Auth token stored");

      // Notify all extension views about successful authentication
      chrome.runtime.sendMessage({
        type: "AUTH_STATUS_CHANGED",
        isAuthenticated: true,
      });
    });

    sendResponse({ success: true });
  }

  // Handle request for page data
  if (message.type === "GET_PAGE_DATA") {
    sendResponse({ data: latestPageData });
  }

  // Handle request to check authentication status
  if (message.type === "CHECK_AUTH_STATUS") {
    chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => {
      sendResponse({ isAuthenticated: !!result[AUTH_STORAGE_KEY] });
    });

    return true; // Indicates we'll send a response asynchronously
  }
});

// Listen for tab updates to analyze new pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only analyze when the page is fully loaded
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://")
  ) {
    // Inject the content script to analyze the page
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ["content/contentScript.js"],
      })
      .catch((error) => {
        console.error("Error injecting content script:", error);
      });
  }
});

// Initialize the background script
function initialize() {
  console.log("TuzzAI background script initialized");

  // Check if we have stored page data
  chrome.storage.local.get([PAGE_DATA_STORAGE_KEY], (result) => {
    if (result[PAGE_DATA_STORAGE_KEY]) {
      latestPageData = result[PAGE_DATA_STORAGE_KEY];
      console.log("Loaded stored page data:", latestPageData);
    }
  });
}

// Run the initialization when the background script loads
initialize();

export {};
