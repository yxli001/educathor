import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface User {
    _id: string;
    auth0Id: string;
    email?: string;
    name?: string;
    picture?: string;
}

interface UserContextType {
    user: User | null;
    loading: boolean;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
});

export const useAuth = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                if (!isAuthenticated) {
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const token = await getAccessTokenSilently();

                const res = await fetch(
                    "http://localhost:5000/api/auth/handle-login",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await res.json();
                setUser(data.user);
            } catch (err) {
                console.error("Failed to fetch user from backend:", err);
            } finally {
                setLoading(false);
            }
        };

        if (!isLoading) {
            fetchUser();
        }
    }, [isAuthenticated, isLoading, getAccessTokenSilently]);

    return (
        <UserContext.Provider value={{ user, loading }}>
            {children}
        </UserContext.Provider>
    );
};
