import React, { useState } from "react";
import axios from "axios";

function CheatSheet() {
    const [files, setFiles] = useState<File[]>([]);
    const [cheatSheet, setCheatSheet] = useState<Blob | null>(null);
    const [loading, setLoading] = useState(false);

    //const [numPages, setNumPages] = useState(1);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        setFiles(selectedFiles);
        setCheatSheet(null); // Clear any previous summary
    };

    const handleSummarize = async () => {
        if (files.length === 0) return;
        setLoading(true);

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));

        try {
            const response = await axios.post(
                "http://localhost:5174/api/cheatsheet",
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                    responseType: "blob",
                }
            );

            // Handle the response, which is a Blob (file)
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "cheatsheet.pdf");
            document.body.appendChild(link);
            link.click();

            // Cleanup
            link.remove();
            window.URL.revokeObjectURL(url);
            setCheatSheet(blob);
        } catch (error) {
            console.error("Upload failed", error);
        } finally {
            setLoading(false);
        }
    };

    const downloadUrl = cheatSheet ? URL.createObjectURL(cheatSheet) : "";

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">CheatSheet AI</h1>

            <input
                type="file"
                accept=".pdf" // ,.txt,.md,.docx
                onChange={handleFileChange}
                className="bg-blue-200 text-black px-4 py-2 rounded"
            />

            <button
                onClick={handleSummarize}
                disabled={files.length === 0 || loading}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
                {loading ? "Generating..." : "Generate Cheat Sheet"}
            </button>

            {cheatSheet && (
                <div className="mt-4">
                    <a
                        href={downloadUrl}
                        download={`cheat-sheet.txt`}
                        className="text-blue-700 underline"
                    >
                        Download Cheat Sheet
                    </a>
                </div>
            )}
        </div>
    );
}

export default CheatSheet;
