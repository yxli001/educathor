// API service for TuzzAI extension
// Handles communication with the EducaThor Hub and Gemini API

// Constants
const EDUCA_THOR_HUB_URL = "https://educathor-hub.example.com"; // Replace with actual URL
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
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
  private geminiApiKey: string | null = null;

  constructor() {
    // Load tokens from storage on initialization
    this.loadTokens();
  }

  // Load authentication tokens from storage
  private async loadTokens(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["tuzzai_auth_token", "gemini_api_key"],
        (result) => {
          this.token = result.tuzzai_auth_token || null;
          this.geminiApiKey = result.gemini_api_key || null;
          resolve();
        }
      );
    });
  }

  // Set authentication token
  public setToken(token: string): void {
    this.token = token;
    chrome.storage.local.set({ tuzzai_auth_token: token });
  }

  // Set Gemini API key
  public setGeminiApiKey(apiKey: string): void {
    this.geminiApiKey = apiKey;
    chrome.storage.local.set({ gemini_api_key: apiKey });
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

  // Check if Gemini API key is set
  public hasGeminiApiKey(): boolean {
    return !!this.geminiApiKey;
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
    if (!this.geminiApiKey) {
      throw new Error("Gemini API key not set");
    }

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
        throw new Error(`Gemini API error: ${response.status}`);
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
    context: string
  ): Promise<ChatResponse> {
    if (!this.geminiApiKey) {
      throw new Error("Gemini API key not set");
    }

    try {
      // Prepare the prompt for Gemini
      const prompt = `
        You are TuzzAI, an educational assistant that helps students understand homework questions without giving direct answers.
        
        Context from the student's homework: ${context.substring(0, 2000)}
        
        Student's question: ${message}
        
        Provide a helpful explanation and 2-3 hints that guide the student toward the answer without giving it directly.
        Format your response as:
        EXPLANATION: [Your explanation here]
        HINTS:
        1. [First hint]
        2. [Second hint]
        3. [Third hint if applicable]
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
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const geminiResponse: GeminiResponse = await response.json();

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
