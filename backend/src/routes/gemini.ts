import express, { Request, Response, Router } from "express";
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

/**
 * @api {post} /api/gemini/chat
 * @apiDescription Send a message to Gemini API and get a response
 */
geminiRouter.post("/chat", (req: Request, res: Response) => {
  const handleRequest = async () => {
    try {
      const { prompt, pageContent, highlightedText } =
        req.body as GeminiRequest;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Prepare the full prompt with context
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

      // Call Gemini API
      const response = await fetch(
        `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: fullPrompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status}`, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const geminiResponse: GeminiResponse = await response.json();
      const responseText =
        geminiResponse.candidates[0]?.content.parts[0]?.text || "";

      // Extract hints from the response
      const hints = extractHints(responseText);

      return res.json({
        message: responseText,
        hints,
      });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  handleRequest();
});

/**
 * @api {post} /api/gemini/analyze
 * @apiDescription Analyze page content using Gemini API
 */
geminiRouter.post("/analyze", (req: Request, res: Response) => {
  const handleRequest = async () => {
    try {
      const { content, screenshot } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Prepare the prompt for Gemini
      const prompt = `
        Analyze the following homework content and identify:
        1. The main questions or problems
        2. The key concepts being tested
        3. Any relevant context that would help explain the material
        
        Content: ${content.substring(0, 3000)} // Limit content length
      `;

      // Call Gemini API
      const response = await fetch(
        `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status}`, errorText);
        return res.status(response.status).json({ error: errorText });
      }

      const geminiResponse: GeminiResponse = await response.json();
      const analysisText =
        geminiResponse.candidates[0]?.content.parts[0]?.text || "";

      // Parse the response to extract questions and context
      const questions = extractQuestions(analysisText);
      const context = extractContext(analysisText);

      return res.json({
        questions,
        context,
        screenshot,
      });
    } catch (error) {
      console.error("Error analyzing page with Gemini:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  handleRequest();
});

// Helper functions
function extractHints(text: string): string[] {
  // Look for lines that start with "Hint:" or "Hint 1:", etc.
  const hintRegex = /(?:^|\n)(?:Hint(?:\s+\d+)?:?\s*)(.+?)(?=\n|$)/gi;
  const hints: string[] = [];
  let match;

  while ((match = hintRegex.exec(text)) !== null) {
    hints.push(match[1].trim());
  }

  return hints;
}

function extractQuestions(text: string): string[] {
  // Look for numbered questions or bullet points
  const questionRegex = /(?:^|\n)(?:\d+\.|\*|\-)\s*(.+?)(?=\n|$)/g;
  const questions: string[] = [];
  let match;

  while ((match = questionRegex.exec(text)) !== null) {
    questions.push(match[1].trim());
  }

  return questions;
}

function extractContext(text: string): string {
  // Look for context section
  const contextMatch = text.match(/Context:?\s*([\s\S]+?)(?=\n\n|$)/i);
  return contextMatch ? contextMatch[1].trim() : "";
}

export default geminiRouter;
