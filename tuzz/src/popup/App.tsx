import React, { useState, useEffect } from "react";

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [conversation, setConversation] = useState<string[]>([]);

    // On load, check auth status with the background
    useEffect(() => {
        chrome.runtime.sendMessage(
            { type: "CHECK_AUTH_STATUS" },
            (response) => {
                if (response?.isAuthenticated) {
                    setIsAuthenticated(true);
                }
            }
        );
    }, []);

    const handleLogin = () => {
        // Example: redirect to EducaThor Hub for authentication
        // This might open a new tab or window for Auth0 login
        window.open("https://educathor-hub.example.com/login", "_blank");
    };

    const handleSendPrompt = () => {
        if (!prompt.trim()) return;

        // For now, just do a local echo in the conversation
        setConversation([...conversation, `User: ${prompt}`]);

        // Example: you could forward the prompt to your server or
        // AI route to get a partial/hint response.
        // We'll just mock it:
        setConversation((prev) => [...prev, "TuzzAI: (sample response)"]);

        setPrompt("");
    };

    return (
        <div style={{ width: 300, padding: 10 }}>
            <h2>TuzzAI Chat</h2>

            {isAuthenticated ? (
                <>
                    <div
                        style={{
                            border: "1px solid #ccc",
                            padding: 8,
                            height: 200,
                            overflow: "auto",
                        }}
                    >
                        {conversation.map((msg, idx) => (
                            <div key={idx}>{msg}</div>
                        ))}
                    </div>
                    <input
                        style={{ width: "100%", marginTop: 8 }}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask something..."
                    />
                    <button
                        style={{ marginTop: 8, width: "100%" }}
                        onClick={handleSendPrompt}
                    >
                        Send
                    </button>
                </>
            ) : (
                <div>
                    <p>You are not authenticated.</p>
                    <button onClick={handleLogin}>Login with EducaThor</button>
                </div>
            )}
        </div>
    );
}
