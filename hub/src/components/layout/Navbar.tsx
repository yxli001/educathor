import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";

const Navbar = () => {
    const { logout, isAuthenticated, getAccessTokenSilently } = useAuth0();

    if (isAuthenticated) {
        getAccessTokenSilently().then((token) => {
            console.log("Token: ", token);
        });
    }

    return (
        <div className="h-18 w-full bg-gray-800 text-white flex items-center justify-between px-6 shadow-md">
            <Link
                className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                to="/"
            >
                EducaThor
            </Link>

            <div className="">
                <Link
                    className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                    to="/mind-mapper"
                >
                    MindMapper
                </Link>

                <Link
                    className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                    to="/cheatsheet"
                >
                    Cheatsheet
                </Link>
            </div>

            <div>
                <button
                    className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                    onClick={() =>
                        logout({
                            logoutParams: {
                                returnTo: window.location.origin,
                            },
                        })
                    }
                >
                    Log out
                </button>
            </div>
        </div>
    );
};

export default Navbar;
