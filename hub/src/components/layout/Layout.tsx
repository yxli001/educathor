import { Outlet } from "react-router";
import Navbar from "./Navbar";
import Forbidden from "@/pages/Forbidden";
import { useAuth } from "@/contexts/AuthContext";

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
        <div className="h-screen flex flex-col">
            <Navbar />
            <div className="w-full flex-1 bg-gradient-to-br from-blue-100 via-purple-200 to-indigo-400">
                <Outlet />
            </div>
        </div>
    );
};
export default Layout;
