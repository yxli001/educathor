import { useState } from "react";
import axios from "axios";
// import logo from "../assets/MindMapper-logo.png";

export default function MindMapper() {
    const [file, setFile] = useState<File | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loadingMode, setLoadingMode] = useState<
        "mindmap" | "summary" | null
    >(null);

    const handleUpload = async (mode: "mindmap" | "summary") => {
        if (!file) return;
        setLoadingMode(mode);
        setPdfUrl(null);
        const formData = new FormData();
        formData.append("image", file);
        formData.append("mode", mode);

        try {
            const response = await axios.post(
                "http://localhost:5174/api/analyze",
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                    responseType: "blob",
                }
            );
            if (response.data.size === 0) {
                throw new Error("Received empty PDF");
            }
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setLoadingMode(null);
        }
    };

    return (
        <div className="p-6 max-w-xl mx-auto">
            {/* <img
                src={logo}
                alt="MindMapper Banner"
                className="w-full h-auto mb-4 rounded"
            /> */}
            <h1 className="text-2xl font-bold mb-4">MindMapper Upload</h1>
            <input
                type="file"
                accept="image/png, image/jpeg"
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        setFile(e.target.files[0]);
                        setPdfUrl(null); // reset previous PDF
                    }
                }}
                className="mb-4"
            />
            {file && (
                <p className="text-sm text-gray-600">Selected: {file.name}</p>
            )}

            {file && (
                <div className="flex flex-col gap-2 mb-4">
                    <button
                        onClick={() => handleUpload("mindmap")}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                        disabled={loadingMode !== null}
                    >
                        {loadingMode === "mindmap"
                            ? "Generating Mind Map..."
                            : "Generate Mind Map PDF"}
                    </button>

                    <button
                        onClick={() => handleUpload("summary")}
                        className="bg-green-500 text-white px-4 py-2 rounded"
                        disabled={loadingMode !== null}
                    >
                        {loadingMode === "summary"
                            ? "Generating Summary..."
                            : "Generate Bullet Summary PDF"}
                    </button>
                </div>
            )}

            {pdfUrl && (
                <div className="mt-4">
                    <a
                        href={pdfUrl}
                        download="output.pdf"
                        className="text-blue-600 underline"
                    >
                        Download PDF
                    </a>
                </div>
            )}
        </div>
    );
}
