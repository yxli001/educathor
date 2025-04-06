import { Route, Routes } from "react-router";
import "./App.css";
import Landing from "@/pages/Landing";
import MindMapper from "./pages/MindMapper";
import Layout from "./components/layout/Layout";
import CheatSheet from "@/pages/CheatSheet";
import AuthBridge from "./pages/AuthBridge";

const App = () => {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Landing />} />
                <Route path="/mind-mapper" element={<MindMapper />} />
                <Route path="/cheatsheet" element={<CheatSheet />} />
            </Route>
            <Route path="/auth-bridge" element={<AuthBridge />} />
        </Routes>
    );
};

export default App;
