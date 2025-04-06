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
        console.log("Got token:", token);

        // Try to send the token to the extension using window.opener
        if (window.opener) {
          console.log("Sending token to opener window");
          window.opener.postMessage({ type: "educathor-token", token }, "*");
          window.close();
        } else {
          console.error("No opener window found");

          // Try to find the extension window by name
          const extensionWindow = window.open("", "auth_window");
          if (extensionWindow) {
            console.log("Found extension window by name");
            extensionWindow.postMessage(
              { type: "educathor-token", token },
              "*"
            );
            // window.close();
          } else {
            console.error("Could not find extension window");

            // Last resort: store token in localStorage and redirect
            console.log("Storing token in localStorage as fallback");
            localStorage.setItem("educathor_token", token);
          }
        }
      } catch (err) {
        console.error("Failed to get token:", err);
      }
    };

    if (isAuthenticated) {
      console.log("User is authenticated, sending token");
      sendTokenToExtension();
    } else if (!isLoading) {
      console.log("User is not authenticated, redirecting to login");
      loginWithRedirect({ appState: { targetUrl: "/auth-bridge" } });
    }
  }, [isAuthenticated, isLoading, getAccessTokenSilently, loginWithRedirect]);

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
      <span className="text-2xl">Connecting to TuzzAI extension...</span>
    </div>
  );
};

export default AuthBridge;
