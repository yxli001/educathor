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

                console.log("Sending token to extension", token);

                // Send the token to the extension
                window.postMessage(
                    {
                        type: "educathor-token",
                        token,
                    },
                    "*"
                );

                window.close();
            } catch (err) {
                console.error("Failed to get token:", err);
            }
        };

        if (isAuthenticated) {
            console.log("User is authenticated, sending token: ");
            sendTokenToExtension();
        } else if (!isLoading) {
            console.log("User is not authenticated, redirecting to login");
            loginWithRedirect({
                appState: { returnTo: "/auth-bridge" },
                authorizationParams: {
                    redirect_uri: window.location.origin + "/auth-bridge",
                },
            });
        }
    }, [isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect]);

    return (
        <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
            <span className="text-2xl">Connecting to TuzzAI extension...</span>
        </div>
    );
};

export default AuthBridge;
