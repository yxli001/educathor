// Screenshot handling
const captureBtn = document.getElementById("captureBtn") as HTMLButtonElement;
const screenshotPreview = document.getElementById(
  "screenshotPreview"
) as HTMLDivElement;
const screenshotImg = document.getElementById(
  "screenshotImg"
) as HTMLImageElement;
const confirmScreenshotBtn = document.getElementById(
  "confirmScreenshot"
) as HTMLButtonElement;
const cancelScreenshotBtn = document.getElementById(
  "cancelScreenshot"
) as HTMLButtonElement;

let currentScreenshot: string | null = null;

// Function to capture screenshot
async function captureScreenshot() {
  try {
    // Send message to background script to capture screenshot
    const response = await chrome.runtime.sendMessage({
      type: "CAPTURE_SCREENSHOT",
    });

    if (response && response.dataUrl) {
      currentScreenshot = response.dataUrl;
      screenshotImg.src = response.dataUrl;
      screenshotPreview.classList.add("visible");
    }
  } catch (error) {
    console.error("Error capturing screenshot:", error);
  }
}

// Event listeners for screenshot functionality
captureBtn.addEventListener("click", captureScreenshot);

confirmScreenshotBtn.addEventListener("click", () => {
  if (currentScreenshot) {
    // Here you can add code to handle the confirmed screenshot
    // For example, send it to your server or save it
    console.log("Screenshot confirmed");
  }
  screenshotPreview.classList.remove("visible");
  currentScreenshot = null;
});

cancelScreenshotBtn.addEventListener("click", () => {
  screenshotPreview.classList.remove("visible");
  currentScreenshot = null;
  screenshotImg.src = "";
});
