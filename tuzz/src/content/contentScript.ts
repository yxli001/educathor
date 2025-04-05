// src/content/contentScript.ts

// Basic example: gather text from all paragraphs on the page
function gatherPageData(): string {
    const paragraphs = Array.from(document.querySelectorAll("p"));
    const textContent = paragraphs.map((p) => p.innerText).join("\n");
    return textContent;
}

// If you need a screenshot, you'd call the chrome API from the background or
// use chrome.tabs.captureVisibleTab if you have 'tabs' permission.
// Typically you'd send a message to the background script to coordinate that.

console.log("TuzzAI content script loaded.");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_PAGE_DATA") {
        const data = gatherPageData();
        sendResponse({ data });
    }

    // In a real scenario, you might do more sophisticated HTML parsing
    // or store relevant question numbers, etc.

    return true;
});

export {};
