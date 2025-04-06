import { Outlet } from "react-router";
import Navbar from "./Navbar";
import Forbidden from "@/pages/Forbidden";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";
import "./styles.css";

const Layout = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <span className="text-2xl">Loading...</span>
            </div>
        );
    }

    if (!user) {
        return <Forbidden />;
    }

    return (
        // "bg-gradient-to-br from-blue-100 via-purple-200 to-indigo-400"
        <div className="flex flex-col">
            <Navbar />
            <div className="w-full min-h-screen bg-gradient-animate">
                <Outlet />
            </div>
        </div>
    );
};
export default Layout;
