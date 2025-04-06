// src/background/index.ts

// Background script for TuzzAI extension
// This script runs in the background and handles authentication and data processing

// Constants
const AUTH_STORAGE_KEY = "educathor-token";
const PAGE_DATA_STORAGE_KEY = "tuzzai_page_data";

// Popup window configuration
const POPUP_CONFIG = {
  // Set to true to use screen-proportional dimensions, false to use fixed dimensions
  useProportionalDimensions: false,
  // Fixed dimensions (used when useProportionalDimensions is false)
  fixedWidth: 200,
  fixedHeight: 300,
  // Proportional dimensions (used when useProportionalDimensions is true)
  // These are percentages of the screen width and height
  proportionalWidthPercent: 10,
  proportionalHeightPercent: 15,
};

// Store for the latest analyzed page data
let latestPageData: any = null;
// Store for the popup window ID
let popupWindowId: number | null = null;
// Store for the size check interval
let sizeCheckInterval: number | null = null;

// Function to log the current popup window size
function logPopupWindowSize() {
  if (popupWindowId !== null) {
    chrome.windows.get(popupWindowId, (windowInfo) => {
      console.log("POPUP SIZE CHECK - Current popup window size:", {
        width: windowInfo.width,
        height: windowInfo.height,
        left: windowInfo.left,
        top: windowInfo.top,
      });
    });
  } else {
    console.log("POPUP SIZE CHECK - No popup window ID available");
  }
}

// Function to start periodic size checking
function startSizeCheck() {
  console.log("POPUP SIZE CHECK - Starting size check");

  // Clear any existing interval
  if (sizeCheckInterval !== null) {
    clearInterval(sizeCheckInterval);
    console.log("POPUP SIZE CHECK - Cleared existing interval");
  }

  // Log size immediately
  logPopupWindowSize();

  // Set up interval to check size every 2 seconds
  sizeCheckInterval = window.setInterval(() => {
    logPopupWindowSize();
  }, 2000);

  console.log("POPUP SIZE CHECK - Set up interval for size checking");
}

// Function to stop periodic size checking
function stopSizeCheck() {
  if (sizeCheckInterval !== null) {
    clearInterval(sizeCheckInterval);
    sizeCheckInterval = null;
  }
}

self.addEventListener("message", (event) => {
  if (event.data.type && event.data.type == AUTH_STORAGE_KEY) {
    console.log("Content script received message: " + event.data.text);

    // Store the token in local storage
    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: event.data.token }, () => {
      console.log("Token stored:", event.data.token);
    });
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);

  console.log("Sender:", sender);

  if (message.type === "educathor-token") {
    console.log("Received token from content script:", message.data.token);

    // Store the token in local storage
    chrome.storage.local.set({ [AUTH_STORAGE_KEY]: message.data.token }, () => {
      console.log("Token stored:", message.data.token);
    });
  }

  if (message.type === "educathor-logout") {
    console.log("Received logout message from content script");

    // Remove the token from local storage
    chrome.storage.local.remove([AUTH_STORAGE_KEY], () => {
      console.log("Token removed");
    });
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
            // Capture the visible tab with specific options
            chrome.tabs.captureVisibleTab(
              window.id,
              {
                format: "png",
                quality: 100,
              },
              (dataUrl) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Screenshot capture error:",
                    chrome.runtime.lastError
                  );
                  sendResponse({
                    dataUrl: "",
                    error: chrome.runtime.lastError.message,
                  });
                } else {
                  console.log("Screenshot captured successfully");
                  sendResponse({ dataUrl });
                }
              }
            );
          } else {
            console.error("Window ID is undefined");
            sendResponse({ dataUrl: "", error: "Window ID is undefined" });
          }
        });
      } else {
        console.error("No active tab found");
        sendResponse({ dataUrl: "", error: "No active tab found" });
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

    // Close the popup window if its ID is stored
    if (popupWindowId !== null) {
      // Stop size checking
      stopSizeCheck();

      chrome.windows.remove(popupWindowId, () => {
        console.log("Popup window closed successfully");
        popupWindowId = null; // Reset the popupWindowId
        sendResponse({ success: true });
      });
    } else {
      console.error("No popup window ID found");
      sendResponse({ success: false });
    }

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
  console.log("EXTENSION ICON CLICKED - Creating popup window");

  // Create a popup window with very small dimensions
  chrome.windows.create(
    {
      url: chrome.runtime.getURL("popup/index.html"),
      type: "popup",
      width: 200,
      height: 300,
      focused: true,
    },
    (window) => {
      if (window && window.id !== undefined) {
        popupWindowId = window.id;
        console.log("POPUP CREATION - Window created with ID:", popupWindowId);

        // Log the actual window size
        chrome.windows.get(window.id as number, (windowInfo) => {
          console.log("POPUP CREATION - Actual window size:", {
            width: windowInfo.width,
            height: windowInfo.height,
          });

          // Force the window to maintain its size
          chrome.windows.update(
            window.id as number,
            {
              width: 200,
              height: 300,
            },
            () => {
              console.log("POPUP CREATION - Window size forced to 200x300");

              // Log the actual window size again
              chrome.windows.get(window.id as number, (windowInfo) => {
                console.log(
                  "POPUP CREATION - Actual window size after force update:",
                  {
                    width: windowInfo.width,
                    height: windowInfo.height,
                  }
                );
              });
            }
          );
        });
      } else {
        console.error("POPUP CREATION - Failed to create popup window");
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
    console.log("Stored token:", result[AUTH_STORAGE_KEY]);
    if (result[AUTH_STORAGE_KEY]) {
      console.log("Found stored token");
    } else {
      console.log("No stored token found");
    }
  });

  // Test if the extension icon click event is working
  console.log("Testing extension icon click event...");

  // Remove any existing listeners
  chrome.action.onClicked.removeListener(() => {});

  // Add a new listener
  chrome.action.onClicked.addListener(() => {
    console.log("EXTENSION ICON CLICKED - Test successful!");

    // Create a popup window with very small dimensions
    chrome.windows.create(
      {
        url: chrome.runtime.getURL("popup/index.html"),
        type: "popup",
        width: 200,
        height: 300,
        focused: true,
      },
      (window) => {
        if (window && window.id !== undefined) {
          popupWindowId = window.id;
          console.log(
            "POPUP CREATION - Window created with ID:",
            popupWindowId
          );

          // Log the actual window size
          chrome.windows.get(window.id as number, (windowInfo) => {
            console.log("POPUP CREATION - Actual window size:", {
              width: windowInfo.width,
              height: windowInfo.height,
            });
          });
        } else {
          console.error("POPUP CREATION - Failed to create popup window");
        }
      }
    );
  });

  console.log("Extension icon click event listener added");
}

// Run initialization
initialize();

export {};
