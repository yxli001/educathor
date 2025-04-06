import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { apiService } from "../services/api";
import ReactMarkdown from "react-markdown";

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
  hints?: string[];
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
  const popupRef = useRef<HTMLDivElement>(null);

  // Check authentication status on mount
  useEffect(() => {
    if (REQUIRE_AUTH) {
      checkAuthStatus();
    }
    capturePageContent();
    getHighlightedText();

    // Prevent the popup from closing when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      // This prevents the default behavior of closing the popup
      e.preventDefault();
      e.stopPropagation();
    };

    // Add event listener to the window object
    window.addEventListener("click", handleClickOutside, true);

    // Also prevent the default behavior of the popup window
    window.addEventListener(
      "blur",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    // Clean up event listeners
    return () => {
      window.removeEventListener("click", handleClickOutside, true);
      window.removeEventListener(
        "blur",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );
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
    console.log("Close button clicked");
    // Close the popup by sending a message to the background script
    chrome.runtime.sendMessage({ type: "CLOSE_POPUP" }, (response) => {
      console.log("Close popup response:", response);
    });
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
        hints: response.hints,
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

  // Handle send button click
  const handleSendButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleSendMessage();
  };

  // Handle hint click
  const handleHintClick = (hint: string) => {
    // Add hint as a user message
    const hintMessage: Message = {
      id: Date.now().toString(),
      text: `Hint: ${hint}`,
      sender: "user",
    };
    setMessages((prev) => [...prev, hintMessage]);
    setInputValue("");

    // Show loading state
    setIsLoading(true);

    // Send hint to API
    apiService
      .sendChatMessage(`Please explain this hint: ${hint}`, pageContent)
      .then((response) => {
        // Add bot message to chat
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: response.message,
          sender: "bot",
          hints: response.hints,
        };
        setMessages((prev) => [...prev, botMessage]);
      })
      .catch((error) => {
        console.error("Error sending hint:", error);
        // Add error message to chat
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "Sorry, I encountered an error. Please try again.",
          sender: "bot",
        };
        setMessages((prev) => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Render authentication required message
  if (REQUIRE_AUTH && !isAuthenticated) {
    return (
      <div className="popup-container" ref={popupRef}>
        <div className="auth-container">
          <h2>Authentication Required</h2>
          <p>Please log in to use TuzzAI.</p>
          <button
            className="auth-button"
            onClick={() => {
              chrome.tabs.create({ url: apiService.getAuthUrl() });
            }}
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  // Render main popup content
  return (
    <div className="popup-container" ref={popupRef}>
      <div className="header">
        <h1>TuzzAI</h1>
        <button className="close-button" onClick={handleClosePopup}>
          ×
        </button>
      </div>

      <div className="chat-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to TuzzAI!</h2>
            <p>
              Ask me anything about your homework, and I'll help you understand
              it better.
            </p>
            <p>
              I won't give you direct answers, but I'll provide hints and
              explanations to help you learn.
            </p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${
                  message.sender === "user" ? "user" : "bot"
                }`}
              >
                <div className="message-content">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
                {message.hints && message.hints.length > 0 && (
                  <div className="hints-container">
                    <h4>Hints:</h4>
                    <div className="hints-buttons">
                      {message.hints.map((hint, index) => (
                        <button
                          key={index}
                          className="hint-button"
                          onClick={() => handleHintClick(hint)}
                        >
                          Hint {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question..."
          className="chat-input"
        />
        <button
          className="send-button"
          onClick={handleSendButtonClick}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? "..." : "Send"}
        </button>
      </div>
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
