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

// Set this to true to enable authentication
const REQUIRE_AUTH = true;

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
                console.error(
                    `Gemini API error: ${response.status}`,
                    errorText
                );
                throw new Error(
                    `Gemini API error: ${response.status} - ${errorText}`
                );
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
            prompt += `\n\nPlease provide a CONCISE and helpful response with the following guidelines:
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
                        parts: [{ text: prompt }],
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
                throw new Error(
                    `API request failed with status ${response.status}`
                );
            }

            // Parse the response
            const data = (await response.json()) as ChatResponse;
            console.log("Gemini API response:", data);

            // Extract the message from the response
            let messageText =
                data.candidates[0]?.content.parts[0]?.text ||
                "No response from AI";

            // Extract hints from the message (if any)
            const hints = this.extractHints(messageText);

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
        const contextMatch = analysisText.match(
            /context:([\s\S]*?)(?=\n\n|$)/i
        );
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
            console.log(
                "No hints found with primary pattern, trying alternatives"
            );

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
