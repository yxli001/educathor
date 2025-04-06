import { useAuth0 } from "@auth0/auth0-react";

const Forbidden = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
            <span className="text-2xl">
                Please{" "}
                <a
                    className="underline cursor-pointer"
                    onClick={() => loginWithRedirect()}
                >
                    login
                </a>{" "}
                to proceed.
            </span>
        </div>
    );
};

export default Forbidden;
