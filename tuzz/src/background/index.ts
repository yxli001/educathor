// src/background/index.ts

chrome.runtime.onInstalled.addListener(() => {
    console.log("TuzzAI extension installed.");
});

// You could listen for messages from content scripts or the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CHECK_AUTH_STATUS") {
        // Example: check user token or state, or talk to your backend
        const isAuthenticated = false; // Replace with real logic
        sendResponse({ isAuthenticated });
    }

    return true; // indicates you’ll send a response asynchronously
});

export {};
