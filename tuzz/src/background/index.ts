// src/background/index.ts

// Background script for TuzzAI extension
// This script runs in the background and handles authentication and data processing

// Constants
const AUTH_STORAGE_KEY = "accessToken";
const PAGE_DATA_STORAGE_KEY = "tuzzai_page_data";

// Store for the latest analyzed page data
let latestPageData: any = null;
// Store for the popup window ID
let popupWindowId: number | null = null;

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);

  // Handle auth token from EducaThor Hub
  if (message.type === "educathor-token") {
    console.log("Received auth token from EducaThor Hub");

    // Store the token
    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: message.token }, () => {
      console.log("Auth token stored successfully");

      // Notify all extension views about successful authentication
      chrome.runtime.sendMessage({
        type: "AUTH_STATUS_CHANGED",
        isAuthenticated: true,
      });

      // Send response back to the auth bridge
      sendResponse({ success: true });
    });

    return true; // Indicates we'll send a response asynchronously
  }

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

  // Handle close popup request
  if (message.type === "CLOSE_POPUP") {
    console.log("Received CLOSE_POPUP message");

    // Get the current window
    chrome.windows.getCurrent((window) => {
      console.log("Current window:", window);
      if (window && window.id !== undefined) {
        // Close the popup window
        chrome.windows.remove(window.id, () => {
          console.log("Window closed successfully");
          sendResponse({ success: true });
        });
      } else {
        console.error("Failed to get current window");
        sendResponse({ success: false });
      }
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

// Listen for extension icon click
chrome.action.onClicked.addListener(() => {
  console.log("Extension icon clicked, creating popup window");
  // Create a popup window
  chrome.windows.create(
    {
      url: "popup/index.html",
      type: "popup",
      width: 500,
      height: 600,
      focused: true,
    },
    (window) => {
      if (window && window.id !== undefined) {
        popupWindowId = window.id;
        console.log("Popup window created with ID:", popupWindowId);

        // Ensure the window stays focused
        chrome.windows.update(popupWindowId, {
          focused: true,
        });
      } else {
        console.error("Failed to create popup window");
      }
    }
  );
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
  // If our popup window loses focus, bring it back to focus
  if (popupWindowId !== null && windowId !== popupWindowId) {
    console.log("Popup window lost focus, bringing it back to focus");
    chrome.windows.update(popupWindowId, { focused: true });
  }
});

// Initialize the background script
function initialize() {
  console.log("Background script initialized");

  // Check if we have a stored token
  chrome.storage.local.get([AUTH_STORAGE_KEY], (result) => {
    if (result[AUTH_STORAGE_KEY]) {
      console.log("Found stored token");
    } else {
      console.log("No stored token found");
    }
  });
}

// Run initialization
initialize();

export {};
