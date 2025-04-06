import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const AuthBridge = () => {
    const {
        isAuthenticated,
        isLoading,
        getAccessTokenSilently,
        loginWithRedirect,
    } = useAuth0();

    useEffect(() => {
        const sendTokenToExtension = async () => {
            try {
                const token = await getAccessTokenSilently();

                // Send the token to the extension
                window.opener?.postMessage(
                    { type: "educathor-token", token },
                    "*" // Or restrict to your extension's origin
                );

                window.close(); // Close tab after sending
            } catch (err) {
                console.error("Failed to get token:", err);
            }
        };

        if (isAuthenticated) sendTokenToExtension();
        else if (!isLoading)
            loginWithRedirect({ appState: { targetUrl: "/auth-bridge" } });
    }, [isAuthenticated, isLoading]);

    return (
        <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
            <span className="text-2xl">onnecting to TuzzAI extension...</span>
        </div>
    );
};

export default AuthBridge;
