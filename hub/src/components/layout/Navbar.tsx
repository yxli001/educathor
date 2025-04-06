import { useAuth } from "@/contexts/AuthContext";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

const Navbar = () => {
    const { user } = useAuth();
    const { logout } = useAuth0();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        setIsDropdownOpen((prev) => !prev);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="h-18 w-full bg-gray-800 text-white flex items-center justify-between px-6 shadow-md">
            <Link
                className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                to="/"
            >
                EducaThor
            </Link>

            <div className="flex space-x-4">
                <Link
                    className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                    to="mind-mapper"
                >
                    MindMapper
                </Link>

                <Link
                    className="px-4 py-2 text-white font-medium rounded transition duration-200 cursor-pointer hover:underline"
                    to="cheatsheet"
                >
                    Cheatsheet
                </Link>
            </div>

            <div className="relative" ref={dropdownRef}>
                <img
                    src={user?.picture}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full cursor-pointer"
                    onClick={toggleDropdown}
                />
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded shadow-lg">
                        <div className="px-4 py-2 border-b">
                            <p className="font-medium">{user?.name}</p>
                        </div>
                        <button
                            className="w-full px-4 py-2 text-left text-red-600 cursor-pointer hover:bg-gray-100"
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
                )}
            </div>
        </div>
    );
};

export default Navbar;
