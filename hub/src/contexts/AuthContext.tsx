import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import { useAuth0, User } from "@auth0/auth0-react";
import { getUser } from "@/api/users";

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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

                const res = await getUser(token);

                if (!res.success) {
                    console.error("Failed to fetch user:", res.error);
                    setUser(null);
                    return;
                }

                const user = res.data;

                setUser(user);
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
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
