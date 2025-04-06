import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-800 text-gray-100">
            <header className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-12">
                <h1 className="text-5xl font-extrabold tracking-tight mb-4">
                    EducaThor
                </h1>
                <p className="text-xl max-w-xl text-gray-200">
                    Your personalized, AI-powered tutor suite — featuring
                    TuzzAI, MindMapper, and CheatSheet AI. Learn faster,
                    smarter, and on your own terms.
                </p>
                <Link
                    className="mt-8 px-6 py-3 bg-black text-white rounded-2xl text-lg shadow-lg hover:bg-gray-900 transition"
                    to="/app"
                >
                    Launch App
                </Link>
            </header>

            <section className="grid gap-8 md:grid-cols-3 px-8 py-16 rounded-t-3xl">
                <div
                    className="bg-gray-50 p-8 rounded-2xl shadow-md hover:shadow-lg hover:bg-gray-300 transition-shadow duration-300 text-center"
                    onClick={() => {
                        navigate("/");
                    }}
                >
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                        TuzzAI
                    </h3>
                    <p className="text-gray-600">
                        Ask questions about your homework, get hints, and
                        understand concepts — no spoonfeeding, just guidance.
                    </p>
                </div>
                <div
                    className="bg-gray-50 p-8 rounded-2xl shadow-md hover:shadow-lg hover:bg-gray-300 transition-shadow duration-300 text-center"
                    onClick={() => {
                        navigate("/app/mind-mapper");
                    }}
                >
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                        MindMapper
                    </h3>
                    <p className="text-gray-600">
                        Convert scribbles into organized mind maps. Turn your
                        chaos into clarity.
                    </p>
                </div>
                <div
                    className="bg-gray-50 p-8 rounded-2xl shadow-md hover:shadow-lg hover:bg-gray-300 transition-shadow duration-300 text-center"
                    onClick={() => {
                        navigate("/app/cheatsheet");
                    }}
                >
                    <h3 className="text-2xl font-semibold mb-4 text-gray-800">
                        CheatSheet AI
                    </h3>
                    <p className="text-gray-600">
                        Upload notes, get a condensed, space-optimized PDF.
                        Perfect for quick reviews.
                    </p>
                </div>
            </section>

            <footer className="text-center py-6 text-sm text-gray-300">
                © {new Date().getFullYear()} EducaThor. Built with 💡 and ☕.
            </footer>
        </div>
    );
};

export default Landing;
