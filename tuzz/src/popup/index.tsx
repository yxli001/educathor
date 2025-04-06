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

interface Hint {
  id: string;
  text: string;
  isRevealed: boolean;
}

// Main Popup Component
const Popup: React.FC = () => {
  // State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    !REQUIRE_AUTH
  );
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
  const [highlightedText, setHighlightedText] = useState<string>("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check authentication status on mount
  useEffect(() => {
    if (REQUIRE_AUTH) {
      checkAuthStatus();
    }
    capturePageContent();
    getHighlightedText();

    // Prevent the popup from closing when clicking outside
    document.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Clean up event listener
    return () => {
      document.removeEventListener("click", (e) => {
        e.stopPropagation();
      });
    };
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

  // Handle closing the popup
  const handleClosePopup = () => {
    // Close the popup by sending a message to the background script
    chrome.runtime.sendMessage({ type: "CLOSE_POPUP" });
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

  // Get highlighted text from the page
  const getHighlightedText = async () => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab.id) {
        // Execute content script to get highlighted text
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const selection = window.getSelection();
            return selection ? selection.toString() : "";
          },
        });

        setHighlightedText(result as string);
      }
    } catch (error) {
      console.error("Error getting highlighted text:", error);
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
        pageContent,
        highlightedText
      );

      // Add bot response
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.message,
        sender: "bot",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // Store hints
      if (response.hints && response.hints.length > 0) {
        const newHints: Hint[] = response.hints.map((hint, index) => ({
          id: `hint-${Date.now()}-${index}`,
          text: hint,
          isRevealed: false,
        }));
        setHints(newHints);
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

  // Handle revealing a hint
  const handleRevealHint = (hintId: string) => {
    setHints((prev) =>
      prev.map((hint) =>
        hint.id === hintId ? { ...hint, isRevealed: true } : hint
      )
    );
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <div className="popup-container">
      <button className="close-button" onClick={handleClosePopup}>
        ×
      </button>
      {!isAuthenticated && REQUIRE_AUTH ? (
        <div className="auth-container">
          <h2>Welcome to TuzzAI</h2>
          <p>Please log in to the EducaThor Hub to continue.</p>
          <button onClick={handleAuth} className="auth-button">
            Log in to EducaThor Hub
          </button>
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

            {/* Hints section */}
            {hints.length > 0 && (
              <div className="hints-container">
                <h3>Hints</h3>
                {hints.map((hint) => (
                  <div key={hint.id} className="hint-item">
                    {hint.isRevealed ? (
                      <div className="hint-text">{hint.text}</div>
                    ) : (
                      <button
                        onClick={() => handleRevealHint(hint.id)}
                        className="reveal-hint-button"
                      >
                        Reveal Hint
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          <div className="input-container">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your homework..."
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
