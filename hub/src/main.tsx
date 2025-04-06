import { Auth0Provider } from "@auth0/auth0-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router";
import env from "@/utils/env.ts";

const domain = env.VITE_AUTH0_DOMAIN;
const clientId = env.VITE_AUTH0_CLIENT_ID;

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: env.VITE_AUTH0_AUDIENCE,
                scope: "openid profile email",
            }}
            cacheLocation="localstorage"
            useRefreshTokens={true}
        >
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </Auth0Provider>
    </StrictMode>
);
