import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { apiService } from "../services/api";

// Constants
const EDUCA_THOR_HUB_URL = "https://educathor.com/hub";
const AUTH_STORAGE_KEY = "tuzzai_auth_token";
// Set this to false to bypass authentication
const REQUIRE_AUTH = false;

// Types
interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

// Main Popup Component
const Popup: React.FC = () => {
  // State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !REQUIRE_AUTH
  );
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hello! I'm TuzzAI, your homework helper. How can I assist you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageContent, setPageContent] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [geminiApiKey, setGeminiApiKey] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check authentication status on mount
  useEffect(() => {
    if (REQUIRE_AUTH) {
      checkAuthStatus();
    }
    checkGeminiApiKey();
    capturePageContent();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication status
  const checkAuthStatus = async () => {
    const authenticated = apiService.isAuthenticated();
    setIsAuthenticated(authenticated);
  };

  // Check if Gemini API key is set
  const checkGeminiApiKey = async () => {
    const hasKey = apiService.hasGeminiApiKey();
    setHasGeminiApiKey(hasKey);
  };

  // Handle authentication
  const handleAuth = () => {
    // Open EducaThor Hub in a new tab
    chrome.tabs.create({ url: apiService.getAuthUrl() });

    // Listen for auth success message
    const authListener = (message: any) => {
      if (message.type === "AUTH_SUCCESS") {
        apiService.setToken(message.token);
        setIsAuthenticated(true);
        chrome.runtime.onMessage.removeListener(authListener);
      }
    };

    chrome.runtime.onMessage.addListener(authListener);
  };

  // Handle setting Gemini API key
  const handleSetGeminiApiKey = () => {
    if (geminiApiKey.trim()) {
      apiService.setGeminiApiKey(geminiApiKey.trim());
      setHasGeminiApiKey(true);
      setGeminiApiKey("");
    }
  };

  // Capture page content
  const capturePageContent = async () => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab.id) {
        // Execute content script to get page content
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Extract text content from the page
            const textContent = document.body.innerText;
            return textContent.substring(0, 5000); // Limit to 5000 characters
          },
        });

        setPageContent(result as string);

        // Capture screenshot
        const dataUrl = await chrome.tabs.captureVisibleTab();
        setScreenshot(dataUrl);
      }
    } catch (error) {
      console.error("Error capturing page content:", error);
    }
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Send message to API
      const response = await apiService.sendChatMessage(
        userMessage.text,
        pageContent
      );

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Add hints if available
      if (response.hints && response.hints.length > 0) {
        const hintsMessage: Message = {
          id: (Date.now() + 2).toString(),
          text: `Hints:\n${response.hints
            .map((hint, index) => `${index + 1}. ${hint}`)
            .join("\n")}`,
          sender: "bot",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, hintsMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again later.",
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle Gemini API key input change
  const handleGeminiApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGeminiApiKey(e.target.value);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Handle Gemini API key key press
  const handleGeminiApiKeyKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleSetGeminiApiKey();
    }
  };

  return (
    <div className="popup-container">
      {!isAuthenticated && REQUIRE_AUTH ? (
        <div className="auth-container">
          <h2>Welcome to TuzzAI</h2>
          <p>Please log in to the EducaThor Hub to continue.</p>
          <button onClick={handleAuth} className="auth-button">
            Log in to EducaThor Hub
          </button>
        </div>
      ) : !hasGeminiApiKey ? (
        <div className="auth-container">
          <h2>Set Up Gemini API</h2>
          <p>Please enter your Gemini API key to continue.</p>
          <div className="api-key-container">
            <input
              type="password"
              value={geminiApiKey}
              onChange={handleGeminiApiKeyChange}
              onKeyPress={handleGeminiApiKeyKeyPress}
              placeholder="Enter your Gemini API key"
              className="api-key-input"
            />
            <button onClick={handleSetGeminiApiKey} className="api-key-button">
              Set API Key
            </button>
          </div>
          <p className="api-key-help">
            You can get a Gemini API key from the Google AI Studio.
          </p>
        </div>
      ) : (
        <div className="chat-container">
          <div className="messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.sender === "user" ? "user-message" : "bot-message"
                }`}
              >
                <div className="message-content">{message.text}</div>
                <div className="message-timestamp">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-container">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Render the popup using React 18's createRoot
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}

export default Popup;
