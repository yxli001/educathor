// API service for TuzzAI extension
// Handles communication with the EducaThor Hub and Gemini API

// Import API keys from config
import { EDUCA_THOR_HUB_URL, EDUCA_THOR_API_URL } from "../config";

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

export interface ChatHistoryItem {
  message: string;
  sender: "user" | "bot";
  timestamp: string;
}

// API Service
export class ApiService {
  private token: string | null = null;
  private isAuthenticatedFlag: boolean = false;

  constructor() {
    this.loadToken();
    this.loadChatHistory();
  }

  // Load token from storage
  private loadToken(): void {
    chrome.storage.local.get(["educathor-token"], (result) => {
      if (result) {
        this.token = result["educathor-token"];
        this.isAuthenticatedFlag = true;
        console.log(
          "Token loaded from storage:",
          this.token ? "Token is set" : "Token is missing"
        );
      } else {
        this.token = null;
        this.isAuthenticatedFlag = false;
        console.log("No token found in storage");
      }
    });
  }

  // Load chat history on initialization
  private async loadChatHistory(): Promise<void> {
    if (this.token) {
      try {
        const history = await this.fetchChatHistory();
        console.log("Loaded chat history:", history);
        // Handle the chat history (e.g., store it in a state management system)
      } catch (error) {
        console.error("Failed to load chat history:", error);
      }
    }
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
    chrome.storage.local.set({ "educathor-token": token }, () => {
      console.log("Token stored successfully");
    });
  }

  // Clear authentication token
  public clearToken(): void {
    this.token = null;
    this.isAuthenticatedFlag = false;
    chrome.storage.local.remove("educathor-token", () => {
      console.log("Token cleared successfully");
    });
  }

  // Get the current token
  public getToken(): string | null {
    return this.token;
  }

  // Analyze page content using backend API
  public async analyzePage(
    content: string,
    screenshot: string
  ): Promise<AnalysisResponse> {
    try {
      console.log("Sending page content to backend for analysis");

      // Prepare the request body
      const requestBody = {
        content,
        screenshot,
      };

      // Make the API request to the backend
      const response = await fetch(`${EDUCA_THOR_API_URL}/api/gemini/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`, // Include token for authentication
        },
        body: JSON.stringify(requestBody),
      });

      // Check if the response is successful
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend API error:", errorData);
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Parse the response
      const data = await response.json();
      console.log("Backend API response:", data);

      return {
        questions: data.questions,
        context: data.context,
        screenshot: data.screenshot,
      };
    } catch (error) {
      console.error("Error analyzing page content:", error);
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
      console.log("Sending chat message to backend:", message);

      // Prepare the request body
      const requestBody = {
        prompt: message,
        pageContent,
        highlightedText,
      };

      // Make the API request to the backend
      const response = await fetch(`${EDUCA_THOR_API_URL}/api/gemini/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`, // Include token for authentication
        },
        body: JSON.stringify(requestBody),
      });

      // Check if the response is successful
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend API error:", errorData);
        throw new Error(`API request failed with status ${response.status}`);
      }

      // Parse the response
      const data = await response.json();
      console.log("Backend API response:", data);

      return {
        message: data.message,
        hints: data.hints || [],
      };
    } catch (error) {
      console.error("Error sending chat message:", error);
      throw error;
    }
  }

  // Fetch chat history from the backend
  public async fetchChatHistory(): Promise<ChatHistoryItem[]> {
    try {
      console.log("Fetching chat history from backend via /api/user");

      const response = await fetch(`${EDUCA_THOR_API_URL}/api/user`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`, // Include token for authentication
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend API error:", errorData);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log("User data fetched:", data);

      return data.chatHistory || [];
    } catch (error) {
      console.error("Error fetching chat history:", error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const apiService = new ApiService();
