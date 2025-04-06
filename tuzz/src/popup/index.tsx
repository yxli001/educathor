import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { apiService, ChatHistoryItem } from "../services/api";
import ReactMarkdown from "react-markdown";

// Constants
const EDUCA_THOR_HUB_URL = "http://localhost:5173";
// Set this to true to enable authentication
const REQUIRE_AUTH = true;

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pageContent, setPageContent] = useState<string>("");
  const [screenshot, setScreenshot] = useState<string>("");
  const [highlightedText, setHighlightedText] = useState<string>("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const history: ChatHistoryItem[] = await apiService.fetchChatHistory();
        const formattedMessages: Message[] = history.map((item) => ({
          id: `${item.timestamp}-${item.sender}`,
          text: item.message,
          sender: item.sender,
        }));
        setMessages(formattedMessages);
        console.log(
          "Chat history loaded into messages state:",
          formattedMessages
        );
      } catch (error) {
        console.error("Failed to load chat history into frontend:", error);
      }
    };

    loadChatHistory();
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    capturePageContent();
    getHighlightedText();

    // Prevent the popup from closing when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      // Don't prevent clicks on buttons or interactive elements
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === "BUTTON" ||
          e.target.tagName === "INPUT" ||
          e.target.closest(".hints-container"))
      ) {
        return;
      }

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

    // Listen for auth status changes from background script
    const handleAuthStatusChange = (message: any) => {
      if (message.type === "AUTH_STATUS_CHANGED") {
        console.log("Auth status changed:", message.isAuthenticated);
        setIsAuthenticated(message.isAuthenticated);
      }
    };

    chrome.runtime.onMessage.addListener(handleAuthStatusChange);

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
      chrome.runtime.onMessage.removeListener(handleAuthStatusChange);
    };
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication status
  const checkAuthStatus = async () => {
    console.log("Checking authentication status...");

    chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" }, (response) => {
      if (response?.isAuthenticated) {
        setIsAuthenticated(true);
        console.log("User is authenticated.");
      } else {
        setIsAuthenticated(false);
        console.log("User is not authenticated.");
      }
    });

    console.log("Authentication status:", isAuthenticated);
  };

  // Handle authentication
  const handleAuth = () => {
    console.log("Opening auth window");
    // Open EducaThor Hub auth bridge in a popup
    const authWindow = window.open(
      `${EDUCA_THOR_HUB_URL}/auth-bridge`,
      "auth_window",
      "width=500,height=600,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!authWindow) {
      console.error("Failed to open auth window. Popup might be blocked.");
      alert("Please allow popups for this site to authenticate.");
      return;
    }

    // Focus the auth window
    authWindow.focus();

    // Listen for auth token from EducaThor Hub
    const handleMessage = (event: MessageEvent) => {
      console.log("Received message:", event.data);
      if (event.data?.type === "educathor-token") {
        const token = event.data.token;
        apiService.setToken(token);
        setIsAuthenticated(true);
        console.log("Got token from EducaThor Hub!", token);

        // Close the auth window
        if (authWindow) {
          authWindow.close();
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Clean up the message listener after a timeout
    setTimeout(() => {
      window.removeEventListener("message", handleMessage);
    }, 60000); // 1 minute timeout
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
      };

      setMessages((prev) => [...prev, botMessage]);

      // Store hints separately
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
    console.log("Revealing hint with ID:", hintId);
    setHints((prev) => {
      const updatedHints = prev.map((hint) =>
        hint.id === hintId ? { ...hint, isRevealed: !hint.isRevealed } : hint
      );
      console.log("Updated hints:", updatedHints);
      return updatedHints;
    });
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
              chrome.tabs.create({
                url: apiService.getAuthUrl(),
              });
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
              </div>
            ))}

            {/* Display hints separately */}
            {hints.length > 0 && (
              <div className="hints-container">
                <h4>Available Hints:</h4>
                <div className="hints-buttons">
                  {hints.map((hint, index) => (
                    <button
                      key={hint.id}
                      className="hint-button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log(
                          `Hint ${index + 1} clicked, ID: ${hint.id}`
                        );
                        handleRevealHint(hint.id);
                      }}
                    >
                      {hint.isRevealed ? "Hide Hint" : `Hint ${index + 1}`}
                    </button>
                  ))}
                </div>
                {hints.map(
                  (hint, index) =>
                    hint.isRevealed && (
                      <div key={`text-${hint.id}`} className="hint-text">
                        <strong>Hint {index + 1}:</strong> {hint.text}
                      </div>
                    )
                )}
              </div>
            )}

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
