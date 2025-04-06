// API service for TuzzAI extension
// Handles communication with the EducaThor Hub and Gemini API

// Import API keys from config
import { GEMINI_API_KEY, EDUCA_THOR_HUB_URL } from "../config/keys";

// Constants
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const MODEL_NAME = "gemini-2.0-flash";
const API_ENDPOINTS = {
  AUTH: `${EDUCA_THOR_HUB_URL}/auth`,
  ANALYZE: `${EDUCA_THOR_HUB_URL}/api/analyze`,
  CHAT: `${EDUCA_THOR_HUB_URL}/api/chat`,
};

// Set this to false to bypass authentication
const REQUIRE_AUTH = false;

// Types
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AnalysisResponse {
  questions: string[];
  context: string;
  screenshot: string;
}

export interface ChatResponse {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

// API Service
export class ApiService {
  private token: string | null = null;
  private isAuthenticatedFlag: boolean = false;

  constructor() {
    this.loadToken();
    console.log(
      "API Service initialized with Gemini API Key:",
      this.token ? "Key is set" : "Key is missing"
    );
  }

  // Load token from storage
  private loadToken(): void {
    chrome.storage.local.get(["tuzzai_auth_token"], (result) => {
      if (result.tuzzai_auth_token) {
        this.token = result.tuzzai_auth_token;
        this.isAuthenticatedFlag = true;
      }
    });
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return this.isAuthenticatedFlag;
  }

  // Get authentication URL
  public getAuthUrl(): string {
    return API_ENDPOINTS.AUTH;
  }

  // Set authentication token
  public setToken(token: string): void {
    this.token = token;
    this.isAuthenticatedFlag = true;
    chrome.storage.local.set({ tuzzai_auth_token: token });
  }

  // Clear authentication token
  public clearToken(): void {
    this.token = null;
    this.isAuthenticatedFlag = false;
    chrome.storage.local.remove("tuzzai_auth_token");
  }

  // Analyze page content using Gemini API
  public async analyzePage(
    content: string,
    screenshot: string
  ): Promise<AnalysisResponse> {
    try {
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
        `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const geminiResponse: GeminiResponse = await response.json();

      // Extract the text from the response
      const analysisText =
        geminiResponse.candidates[0]?.content.parts[0]?.text || "";

      // Parse the response to extract questions and context
      const questions = this.extractQuestions(analysisText);
      const context = this.extractContext(analysisText);

      return {
        questions,
        context,
        screenshot,
      };
    } catch (error) {
      console.error("Error analyzing page with Gemini:", error);
      throw error;
    }
  }

  // Send chat message using Gemini API
  public async sendChatMessage(
    message: string,
    pageContent?: string,
    highlightedText?: string
  ): Promise<{ message: string; hints?: string[] }> {
    try {
      console.log("Sending chat message to Gemini API:", message);

      // Prepare the prompt with context
      let prompt = `You are TuzzAI, a helpful homework assistant. The user is asking: "${message}"`;

      // Add page content if available
      if (pageContent) {
        prompt += `\n\nContext from the current page: ${pageContent.substring(
          0,
          1000
        )}...`;
      }

      // Add highlighted text if available
      if (highlightedText) {
        prompt += `\n\nHighlighted text from the user: "${highlightedText}"`;
      }

      // Add instructions for the AI
      prompt += `\n\nPlease provide helpful hints and explanations without giving direct answers. 
      If the user has highlighted text, focus on that specific question or problem.
      If the user mentions a specific question number or section, prioritize that in your response.
      Your goal is to help the user understand the concept, not to solve the problem for them.`;

      // Prepare the request body
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
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

      // Make the API request
      const response = await fetch(
        `${API_BASE_URL}/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      // Check if the response is successful
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API error:", errorData);
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Parse the response
      const data = (await response.json()) as ChatResponse;
      console.log("Gemini API response:", data);

      // Extract the message from the response
      const messageText =
        data.candidates[0]?.content.parts[0]?.text || "No response from AI";

      // Extract hints from the message (if any)
      const hints = this.extractHints(messageText);

      return {
        message: messageText,
        hints,
      };
    } catch (error) {
      console.error("Error sending chat message:", error);
      throw error;
    }
  }

  // Helper method to extract questions from Gemini's analysis
  private extractQuestions(analysisText: string): string[] {
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

  // Helper method to extract context from Gemini's analysis
  private extractContext(analysisText: string): string {
    // Extract the context section if it exists
    const contextMatch = analysisText.match(/context:([\s\S]*?)(?=\n\n|$)/i);
    if (contextMatch && contextMatch[1]) {
      return contextMatch[1].trim();
    }

    // If no specific context section, return the first paragraph
    const paragraphs = analysisText.split("\n\n");
    return paragraphs[0] || analysisText.substring(0, 500);
  }

  // Extract hints from the AI response
  private extractHints(message: string): string[] {
    // Simple hint extraction - look for lines starting with "Hint:"
    const hintRegex = /Hint:\s*([^\n]+)/g;
    const hints: string[] = [];
    let match;

    while ((match = hintRegex.exec(message)) !== null) {
      hints.push(match[1].trim());
    }

    return hints;
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
