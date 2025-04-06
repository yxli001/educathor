// Test script for Gemini API
import { GEMINI_API_KEY } from "./config/keys";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent";

async function testGeminiApi() {
  console.log("Testing Gemini API with key:", GEMINI_API_KEY);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Hello, can you help me with my homework?",
              },
            ],
          },
        ],
      }),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", errorText);
      return;
    }

    const data = await response.json();
    console.log("API Response:", JSON.stringify(data, null, 2));

    if (data.candidates && data.candidates.length > 0) {
      const text = data.candidates[0].content.parts[0].text;
      console.log("Generated text:", text);
    } else {
      console.log("No text generated in response");
    }
  } catch (error) {
    console.error("Error testing Gemini API:", error);
  }
}

// Run the test
testGeminiApi();
