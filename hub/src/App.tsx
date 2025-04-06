import { Route, Routes } from "react-router";
import "./App.css";
import Landing from "@/pages/Landing";
import MindMapper from "@/pages/MindMapper";
import Layout from "@/components/layout/Layout";
import CheatSheet from "@/pages/CheatSheet";
import AuthBridge from "@/pages/AuthBridge";
import { AuthProvider } from "@/contexts/AuthContext";

const App = () => {
    return (
        <AuthProvider>
            <Routes>
                <Route index element={<Landing />} />
                <Route path="/app" element={<Layout />}>
                    <Route path="mind-mapper" element={<MindMapper />} />
                    <Route path="cheatsheet" element={<CheatSheet />} />
                </Route>
                <Route path="auth-bridge" element={<AuthBridge />} />
            </Routes>
        </AuthProvider>
    );
};

export default App;
