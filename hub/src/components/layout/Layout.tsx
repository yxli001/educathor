import { Outlet } from "react-router";
import Navbar from "./Navbar";
import { useAuth0 } from "@auth0/auth0-react";
import Forbidden from "@/pages/Forbidden";

const Layout = () => {
    const { isAuthenticated } = useAuth0();

    if (!isAuthenticated) {
        return <Forbidden />;
    }

    return (
        <div className="flex flex-col">
            <Navbar />
            <div className="w-full">
                <Outlet />
            </div>
        </div>
    );
};
export default Layout;
