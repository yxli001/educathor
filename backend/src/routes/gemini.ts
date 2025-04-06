import express, { Request, Response, Router, RequestHandler } from "express";
import env from "@/utils/env";
import User from "@/models/User";
import { authenticateUser } from "@/middlewares/auth";
import createHttpError from "http-errors";

const geminiRouter: Router = express.Router();

// Constants
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const MODEL_NAME = "gemini-2.0-flash";

// Types
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface ChatResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface ChatRequestBody {
  prompt: string;
  pageContent?: string;
  highlightedText?: string;
  screenshot?: string;
}

interface AnalyzeRequestBody {
  content: string;
  screenshot?: string;
}

interface GeminiRequestBody {
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
  generationConfig: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
  };
  safetySettings: Array<{
    category: string;
    threshold: string;
  }>;
}

// Helper functions
function extractHints(message: string): string[] {
  console.log("Extracting hints from message:", message);

  // Look for lines starting with "Hint 1:", "Hint 2:", etc.
  const hintRegex = /Hint\s*\d+:\s*([^\n]+)/g;
  const hints: string[] = [];
  let match;

  while ((match = hintRegex.exec(message)) !== null) {
    console.log("Found hint:", match[1].trim());
    hints.push(match[1].trim());
  }

  // If no hints found with the above pattern, try alternative patterns
  if (hints.length === 0) {
    console.log("No hints found with primary pattern, trying alternatives");

    // Try numbered list format (1. hint text)
    const numberedHintRegex = /^\d+\.\s*([^\n]+)/gm;
    while ((match = numberedHintRegex.exec(message)) !== null) {
      console.log("Found numbered hint:", match[1].trim());
      hints.push(match[1].trim());
    }

    // Try another common format: "Hint:" followed by text
    if (hints.length === 0) {
      const simpleHintRegex = /Hint:\s*([^\n]+)/g;
      while ((match = simpleHintRegex.exec(message)) !== null) {
        console.log("Found simple hint:", match[1].trim());
        hints.push(match[1].trim());
      }
    }
  }

  console.log("Extracted hints:", hints);
  return hints;
}

function extractQuestions(analysisText: string): string[] {
  // Simple extraction - look for lines that end with question marks
  const questionLines = analysisText
    .split("\n")
    .filter((line) => line.trim().endsWith("?"))
    .map((line) => line.trim());

  // If no questions found with question marks, look for numbered items
  if (questionLines.length === 0) {
    const numberedItems = analysisText
      .split("\n")
      .filter((line) => /^\d+\./.test(line.trim()))
      .map((line) => line.trim());

    return numberedItems;
  }

  return questionLines;
}

function extractContext(analysisText: string): string {
  // Extract the context section if it exists
  const contextMatch = analysisText.match(/context:([\s\S]*?)(?=\n\n|$)/i);
  if (contextMatch && contextMatch[1]) {
    return contextMatch[1].trim();
  }

  // If no specific context section, return the first paragraph
  const paragraphs = analysisText.split("\n\n");
  return paragraphs[0] || analysisText.substring(0, 500);
}

/**
 * @api {post} /api/gemini/chat
 * @apiDescription Send a message to Gemini API and get a response
 */
const chatHandler: RequestHandler = async (req, res, next) => {
  try {
    const { sub } = req.user!;
    const { prompt, pageContent, highlightedText, screenshot } =
      req.body as ChatRequestBody;

    console.log("\n=== Chat Request Details ===");
    console.log("User ID:", sub);
    console.log("Prompt:", prompt);
    console.log("Page Content Length:", pageContent?.length || 0);
    console.log("Highlighted Text:", highlightedText || "None");
    console.log("Screenshot Present:", !!screenshot);
    if (screenshot) {
      console.log("Screenshot Type:", typeof screenshot);
      console.log("Screenshot Format:", screenshot.substring(0, 50) + "...");
      console.log("Screenshot Size:", screenshot.length);
    }

    if (!prompt || !sub) {
      next(createHttpError(400, "Prompt and userId are required"));
      return;
    }

    // Prepare the prompt with context
    let fullPrompt = `You are TuzzAI, a helpful homework assistant. The user is asking: "${prompt}"`;

    if (pageContent) {
      fullPrompt += `\n\nContext from the current page: ${pageContent.substring(
        0,
        1000
      )}...`;
      console.log("\n=== Page Content Sample ===");
      console.log(pageContent.substring(0, 200) + "...");
    }

    if (highlightedText) {
      fullPrompt += `\n\nHighlighted text from the user: "${highlightedText}"`;
      console.log("\n=== Highlighted Text ===");
      console.log(highlightedText);
    }

    let requestBody: GeminiRequestBody;

    if (screenshot) {
      console.log("\n=== Processing Screenshot ===");
      // Extract the base64 data from the data URL
      const base64Data = screenshot.split(",")[1];
      console.log("Base64 Screenshot Length:", base64Data.length);

      // Add screenshot to the request
      requestBody = {
        contents: [
          {
            parts: [
              { text: fullPrompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      };
    } else {
      // Original request body without screenshot
      requestBody = {
        contents: [
          {
            parts: [{ text: fullPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 512,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      };
    }

    console.log("\n=== Gemini API Request ===");
    console.log(
      "Request URL:",
      `${API_BASE_URL}/models/${MODEL_NAME}:generateContent`
    );
    console.log(
      "Request Structure:",
      JSON.stringify(
        {
          ...requestBody,
          contents: requestBody.contents.map((content) => ({
            ...content,
            parts: content.parts.map((part) =>
              "inlineData" in part
                ? {
                    ...part,
                    inlineData: { ...part.inlineData, data: "[BASE64_DATA]" },
                  }
                : part
            ),
          })),
        },
        null,
        2
      )
    );

    // Call Gemini API
    const response = await fetch(
      `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("\n=== Gemini API Error ===");
      console.error(`Status: ${response.status}`);
      console.error("Error Details:", errorText);
      next(createHttpError(response.status, errorText));
      return;
    }

    const data = (await response.json()) as ChatResponse;
    console.log("\n=== Gemini API Response ===");
    console.log("Raw Response:", JSON.stringify(data, null, 2));

    // Extract the message from the response
    let messageText =
      data.candidates[0]?.content.parts[0]?.text || "No response from AI";
    console.log("\n=== Extracted Message ===");
    console.log(messageText);

    // Extract hints from the message (if any)
    const hints = extractHints(messageText);
    console.log("\n=== Extracted Hints ===");
    console.log(hints);

    // Remove hints from the main message text
    if (hints.length > 0) {
      console.log("\n=== Processing Message Text ===");
      console.log("Original Length:", messageText.length);

      // Remove the "Here are a few hints to help you:" line if it exists
      messageText = messageText.replace(
        /Here are a few hints to help you:[\s\S]*$/,
        ""
      );

      // Remove any remaining hint lines
      messageText = messageText.replace(/Hint\s*\d+:\s*[^\n]+/g, "");

      // Remove any lines that start with a number followed by a period
      messageText = messageText.replace(/^\d+\.\s*[^\n]+/gm, "");

      // Clean up any double newlines
      messageText = messageText.replace(/\n\s*\n\s*\n/g, "\n\n");

      // Trim the message
      messageText = messageText.trim();

      console.log("Processed Length:", messageText.length);
      console.log("Final Message:", messageText);
    }

    console.log("\n=== Sending Response to Client ===");
    console.log({
      message: messageText.substring(0, 100) + "...",
      hints,
    });

    res.json({
      message: messageText,
      hints,
    });

    // Save chat history to the user's record
    await User.findOneAndUpdate(
      { uid: sub },
      {
        $push: {
          chatHistory: [
            { message: prompt, sender: "user" },
            { message: messageText, sender: "bot" },
          ],
        },
      },
      { new: true }
    );
    console.log("\n=== Chat History Updated ===");
  } catch (error) {
    console.error("\n=== Error in Chat Handler ===");
    console.error("Error Details:", error);
    next(
      createHttpError(
        500,
        "An error occurred while processing your request. Please try again later."
      )
    );
  }
};

/**
 * @api {post} /api/gemini/analyze
 * @apiDescription Analyze page content using Gemini API
 */
const analyzeHandler: RequestHandler = async (req, res, next) => {
  try {
    const { content, screenshot } = req.body as AnalyzeRequestBody;

    if (!content) {
      next(createHttpError(400, "Content is required"));
      return;
    }

    console.log("Received content length:", content.length);
    console.log("Screenshot present:", !!screenshot);
    if (screenshot) {
      console.log("Screenshot size:", screenshot.length);
      console.log("Screenshot format:", screenshot.substring(0, 30));
    }

    // Prepare the prompt for Gemini
    const prompt = `
      You are analyzing a homework question. I've provided both text content and a screenshot image.
      
      IMPORTANT INSTRUCTIONS:
      1. CAREFULLY EXAMINE THE SCREENSHOT IMAGE FIRST. Look for:
         - Multiple choice options (A, B, C, D, etc.)
         - Equations, formulas, or mathematical expressions
         - Graphs, diagrams, or visual aids
         - Any text that might not be in the extracted content
      
      2. Then analyze the text content to understand the question and context.
      
      3. Provide a comprehensive analysis that includes:
         - The main question or problem
         - ALL multiple choice options (if present in either the image or text)
         - Key concepts being tested
         - Relevant context that would help explain the material
      
      If you see multiple choice options in the image that aren't in the text, you MUST include them in your analysis.
      
      Content: ${content.substring(0, 30000)}
    `;

    console.log("Sending prompt to Gemini:", prompt.substring(0, 200) + "...");

    // Prepare request body with screenshot if available
    let requestBody;

    if (screenshot) {
      // Extract the base64 data from the data URL
      const base64Data = screenshot.split(",")[1];
      console.log("Base64 data length:", base64Data.length);

      requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048, // Increased to allow for more detailed responses
        },
      };
    } else {
      requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      };
    }

    console.log("Calling Gemini API with image:", !!screenshot);
    console.log(
      "Request body structure:",
      JSON.stringify(requestBody).substring(0, 200) + "..."
    );

    // Call Gemini API
    const response = await fetch(
      `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status}`, errorText);
      next(createHttpError(response.status, errorText));
      return;
    }

    const geminiResponse: GeminiResponse = await response.json();
    console.log("Gemini API response received");

    const analysisText =
      geminiResponse.candidates[0]?.content.parts[0]?.text || "";
    console.log("Analysis text:", analysisText.substring(0, 200) + "...");

    // Parse the response to extract questions and context
    const questions = extractQuestions(analysisText);
    const context = extractContext(analysisText);

    console.log("Extracted questions:", questions);
    console.log("Extracted context:", context.substring(0, 200) + "...");

    res.json({
      questions,
      context,
      screenshot,
    });
  } catch (error) {
    console.error("Error analyzing page with Gemini:", error);
    next(createHttpError(500, "Internal server error"));
  }
};

// Register routes
geminiRouter.post("/chat", authenticateUser, chatHandler);
geminiRouter.post("/analyze", authenticateUser, analyzeHandler);

export default geminiRouter;
