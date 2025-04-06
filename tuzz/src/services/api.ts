// API service for TuzzAI extension
// Handles communication with the EducaThor Hub and Gemini API

// Import API keys from config
import { EDUCA_THOR_HUB_URL } from "../config/keys";

// Constants
const API_ENDPOINTS = {
  AUTH: `${EDUCA_THOR_HUB_URL}/auth`,
  ANALYZE: `${EDUCA_THOR_HUB_URL}/api/gemini/analyze`,
  CHAT: `${EDUCA_THOR_HUB_URL}/api/gemini/chat`,
};

// Set this to true to enable authentication
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
  hints?: string[];
}

// API Service
export class ApiService {
  private token: string | null = null;
  private isAuthenticatedFlag: boolean = false;

  constructor() {
    this.loadToken();
    console.log(
      "API Service initialized with token:",
      this.token ? "Token is set" : "Token is missing"
    );
  }

  // Load token from storage
  private loadToken(): void {
    chrome.storage.local.get(["accessToken"], (result) => {
      if (result.accessToken) {
        this.token = result.accessToken;
        this.isAuthenticatedFlag = true;
        console.log(
          "Token loaded from storage:",
          this.token ? "Token is set" : "Token is missing"
        );
      }
    });
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return this.isAuthenticatedFlag;
  }

  // Get authentication URL
  public getAuthUrl(): string {
    return `${EDUCA_THOR_HUB_URL}/auth-bridge`;
  }

  // Set authentication token
  public setToken(token: string): void {
    this.token = token;
    this.isAuthenticatedFlag = true;
    chrome.storage.local.set({ accessToken: token }, () => {
      console.log("Token stored successfully");
    });
  }

  // Clear authentication token
  public clearToken(): void {
    this.token = null;
    this.isAuthenticatedFlag = false;
    chrome.storage.local.remove("accessToken", () => {
      console.log("Token cleared successfully");
    });
  }

  // Get the current token
  public getToken(): string | null {
    return this.token;
  }

  // Analyze page content using Gemini API
  public async analyzePage(
    content: string,
    screenshot: string
  ): Promise<AnalysisResponse> {
    try {
      // Call backend API
      const response = await fetch(API_ENDPOINTS.ANALYZE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          screenshot,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error: ${response.status}`, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error analyzing page:", error);
      throw error;
    }
  }

  // Send chat message using Gemini API
  public async sendChatMessage(
    message: string,
    pageContent?: string,
    highlightedText?: string
  ): Promise<ChatResponse> {
    try {
      console.log("Sending chat message:", message);

      // Call backend API
      const response = await fetch(API_ENDPOINTS.CHAT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: message,
          pageContent,
          highlightedText,
        }),
      });

      // Check if the response is successful
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error:", errorData);
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Parse the response
      const data = await response.json();
      console.log("API response:", data);

      return {
        message: data.message,
        hints: data.hints,
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
}

// Create and export a singleton instance
export const apiService = new ApiService();
