// API service for TuzzAI extension
// Handles communication with the EducaThor Hub and Gemini API

// Import API keys from config
import { GEMINI_API_KEY, EDUCA_THOR_HUB_URL } from "../config/keys";

// Constants
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent";
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
  message: string;
  hints: string[];
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
  private geminiApiKey: string = GEMINI_API_KEY;

  constructor() {
    // Load tokens from storage on initialization
    this.loadTokens();
    console.log(
      "API Service initialized with Gemini API Key:",
      this.geminiApiKey ? "Key is set" : "Key is missing"
    );
  }

  // Load authentication tokens from storage
  private async loadTokens(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get(["tuzzai_auth_token"], (result) => {
        this.token = result.tuzzai_auth_token || null;
        resolve();
      });
    });
  }

  // Set authentication token
  public setToken(token: string): void {
    this.token = token;
    chrome.storage.local.set({ tuzzai_auth_token: token });
  }

  // Clear authentication token
  public clearToken(): void {
    this.token = null;
    chrome.storage.local.remove("tuzzai_auth_token");
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return REQUIRE_AUTH ? !!this.token : true;
  }

  // Get authentication URL
  public getAuthUrl(): string {
    return API_ENDPOINTS.AUTH;
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
        `${GEMINI_API_URL}?key=${this.geminiApiKey}`,
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
    context: string,
    highlightedText?: string
  ): Promise<ChatResponse> {
    try {
      console.log(
        "Sending chat message to Gemini API with key:",
        this.geminiApiKey ? "Key is set" : "Key is missing"
      );

      // Prepare the prompt for Gemini
      const prompt = `
        You are TuzzAI, an educational assistant that helps students understand homework questions without giving direct answers.
        
        Context from the student's homework: ${context.substring(0, 2000)}
        
        ${highlightedText ? `Highlighted text: ${highlightedText}` : ""}
        
        Student's question: ${message}
        
        IMPORTANT: DO NOT solve the problem or provide the answer directly. Instead, provide:
        1. A helpful explanation of the concepts involved
        2. 2-3 hints that guide the student toward the answer without giving it directly
        
        Format your response as:
        EXPLANATION: [Your explanation here]
        HINTS:
        1. [First hint]
        2. [Second hint]
        3. [Third hint if applicable]
      `;

      console.log("Making API request to Gemini...");

      // Call Gemini API
      const response = await fetch(
        `${GEMINI_API_URL}?key=${this.geminiApiKey}`,
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

      console.log("Received response from Gemini API");

      const geminiResponse: GeminiResponse = await response.json();
      console.log("Parsed Gemini response:", geminiResponse);

      // Extract the text from the response
      const responseText =
        geminiResponse.candidates[0]?.content.parts[0]?.text || "";

      // Parse the response to extract message and hints
      const { message: botMessage, hints } =
        this.parseChatResponse(responseText);

      return {
        message: botMessage,
        hints,
      };
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
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

  // Helper method to parse Gemini's chat response
  private parseChatResponse(responseText: string): {
    message: string;
    hints: string[];
  } {
    // Extract the explanation
    const explanationMatch = responseText.match(
      /EXPLANATION:([\s\S]*?)(?=HINTS:|$)/i
    );
    const message = explanationMatch
      ? explanationMatch[1].trim()
      : responseText;

    // Extract the hints
    const hintsMatch = responseText.match(/HINTS:([\s\S]*?)$/i);
    let hints: string[] = [];

    if (hintsMatch) {
      const hintsText = hintsMatch[1];
      hints = hintsText
        .split("\n")
        .filter((line) => /^\d+\./.test(line.trim()))
        .map((line) => line.replace(/^\d+\.\s*/, "").trim());
    }

    return { message, hints };
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
