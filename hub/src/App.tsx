import { Route, Routes } from "react-router";
import "./App.css";
import Landing from "@/pages/Landing";
import MindMapper from "@/pages/MindMapper";
import Layout from "@/components/layout/Layout";
import CheatSheet from "@/pages/CheatSheet";
import AuthBridge from "@/pages/AuthBridge";
import { AuthProvider } from "@/contexts/AuthContext";
import { Canvas } from "./components/home/Canvas";
import { useState } from "react";

import { FileWithPosition } from "./types/file";

const App = () => {
    const [files, setFiles] = useState<FileWithPosition[]>([]);
    const [maxZIndex, setMaxZIndex] = useState(1);

    return (
        <AuthProvider>
            <Routes>
                <Route index element={<Landing />} />
                <Route path="/app" element={<Layout />}>
                    <Route
                        index
                        element={
                            <Canvas
                                files={files}
                                setFiles={setFiles}
                                maxZIndex={maxZIndex}
                                setMaxZIndex={setMaxZIndex}
                            />
                        }
                    />
                    <Route path="mind-mapper" element={<MindMapper />} />
                    <Route path="cheatsheet" element={<CheatSheet />} />
                </Route>
                <Route path="auth-bridge" element={<AuthBridge />} />
            </Routes>
        </AuthProvider>
    );
};

export default App;
