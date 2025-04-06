import express, { Request, Response, Router, RequestHandler } from "express";
import env from "@/utils/env";

const geminiRouter: Router = express.Router();

// Constants
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const MODEL_NAME = "gemini-2.0-flash";

// Types
interface GeminiRequest {
  prompt: string;
  pageContent?: string;
  highlightedText?: string;
}

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

interface AnalysisResponse {
  questions: string[];
  context: string;
  screenshot?: string;
}

interface ChatRequestBody {
  prompt: string;
  pageContent?: string;
  highlightedText?: string;
}

interface AnalyzeRequestBody {
  content: string;
  screenshot?: string;
}

/**
 * @api {post} /api/gemini/chat
 * @apiDescription Send a message to Gemini API and get a response
 */
const chatHandler: RequestHandler = async (req, res) => {
  try {
    const { prompt, pageContent, highlightedText } =
      req.body as ChatRequestBody;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    // Prepare the prompt with context
    let fullPrompt = `You are TuzzAI, a helpful homework assistant. The user is asking: "${prompt}"`;

    if (pageContent) {
      fullPrompt += `\n\nContext from the current page: ${pageContent.substring(
        0,
        1000
      )}...`;
    }

    if (highlightedText) {
      fullPrompt += `\n\nHighlighted text from the user: "${highlightedText}"`;
    }

    // Add instructions for the AI
    fullPrompt += `\n\nPlease provide a CONCISE and helpful response with the following guidelines:
    1. Keep your response brief and to the point (max 3-4 sentences)
    2. Focus on explaining concepts rather than giving direct answers
    3. If the user has highlighted text, focus on that specific question
    4. If the user mentions a specific question number, prioritize that
    5. Format your response with proper Markdown (use **bold** for emphasis)
    6. End with 2-3 numbered hints that guide the user toward the answer without giving it directly
    
    Format your hints EXACTLY as follows:
    Hint 1: [First hint]
    Hint 2: [Second hint]
    Hint 3: [Third hint if applicable]
    
    IMPORTANT: Make sure each hint starts with "Hint" followed by a number and a colon.`;

    // Prepare the request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 512, // Reduced from 1024 to encourage shorter responses
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
      res.status(response.status).json({ error: errorText });
      return;
    }

    const data = (await response.json()) as ChatResponse;
    console.log("Gemini API response:", data);

    // Extract the message from the response
    let messageText =
      data.candidates[0]?.content.parts[0]?.text || "No response from AI";

    // Extract hints from the message (if any)
    const hints = extractHints(messageText);

    // Remove hints from the main message text
    if (hints.length > 0) {
      console.log("Removing hints from message text");

      // Remove the "Here are a few hints to help you:" line if it exists
      messageText = messageText.replace(
        /Here are a few hints to help you:[\s\S]*$/,
        ""
      );

      // Remove any remaining hint lines
      messageText = messageText.replace(/Hint\s*\d+:\s*[^\n]+/g, "");

      // Remove any lines that start with a number followed by a period (common hint format)
      messageText = messageText.replace(/^\d+\.\s*[^\n]+/gm, "");

      // Clean up any double newlines that might be left
      messageText = messageText.replace(/\n\s*\n\s*\n/g, "\n\n");

      // Trim the message
      messageText = messageText.trim();

      console.log("Message text after removing hints:", messageText);
    }

    res.json({
      message: messageText,
      hints,
    });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @api {post} /api/gemini/analyze
 * @apiDescription Analyze page content using Gemini API
 */
const analyzeHandler: RequestHandler = async (req, res) => {
  try {
    const { content, screenshot } = req.body as AnalyzeRequestBody;

    if (!content) {
      res.status(400).json({ error: "Content is required" });
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
      res.status(response.status).json({ error: errorText });
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
    res.status(500).json({ error: "Internal server error" });
  }
};

// Register routes
geminiRouter.post("/chat", chatHandler);
geminiRouter.post("/analyze", analyzeHandler);

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

export default geminiRouter;
