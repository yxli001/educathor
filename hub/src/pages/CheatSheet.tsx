import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

function CheatSheet() {
    const [files, setFiles] = useState<File[]>([]);
    const [cheatSheet, setCheatSheet] = useState<Blob | null>(null);
    const iframeSrcRef = useRef<string>("");
    const [loading, setLoading] = useState(false);

    const [serverError, setServerError] = useState(false);
    const [serverErrorMsg, setServerErrorMsg] = useState("");

    const [columns, setColumns] = useState("1");
    const [columnsError, setColumnsError] = useState("");

    const [pages, setPages] = useState("1");
    const [pagesError, setPagesError] = useState("");

    //const [numPages, setNumPages] = useState(1);

    useEffect(() => {}, [files]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        setFiles(selectedFiles);
        setCheatSheet(null); // Clear any previous summary
    };

    const handleColumnsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;

        if (/^\d*$/.test(newValue)) {
            setColumns(newValue);
            if (newValue === "" || parseInt(newValue) <= 0) {
                setColumnsError("Please enter a positive integer.");
            } else {
                setColumnsError("");
            }
        }
    };

    const handlePagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;

        if (/^\d*$/.test(newValue)) {
            setPages(newValue);
            if (newValue === "" || parseInt(newValue) <= 0) {
                setPagesError("Please enter a positive integer.");
            } else {
                setPagesError("");
            }
        }
    };

    const handleSubmit = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setServerError(false);

        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.append("columns", columns);
        formData.append("pages", pages);

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
            setCheatSheet(blob);

            const url = URL.createObjectURL(blob);
            iframeSrcRef.current = url;
        } catch (error) {
            console.error("Cheat sheet generation failed. Try again.", error);
            if (axios.isAxiosError(error)) {
                // You can access the error response and extract the message, if available
                const message =
                    error.response?.data?.message ||
                    "An unexpected error occurred. Please try again.";
                setServerError(true);
                setServerErrorMsg(message);
            } else if (error instanceof Error) {
                // If it's a regular JavaScript error
                setServerError(true);
                setServerErrorMsg(error.message);
            } else {
                // For non-Axios or non-Error type errors
                setServerError(true);
                setServerErrorMsg(
                    "An unknown error occurred. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    //const downloadUrl = cheatSheet ? URL.createObjectURL(cheatSheet) : "";

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-row justify-between gap-20">
            <div className="flex-grow flex flex-col">
                <h1 className="text-2xl font-bold mb-4">CheatSheet AI</h1>

                <p className="text-1xl font-bold">Files</p>
                <p>Supported types: pdf, png, jpg, jpeg, docx</p>
                <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx" // ,.txt,.md,.docx
                    multiple
                    onChange={handleFileChange}
                    className={`px-4 py-2 rounded ${
                        files.length > 0
                            ? "bg-blue-400 hover:bg-blue-500"
                            : "bg-blue-200 hover:bg-blue-300"
                    } text-black mb-6`}
                />

                <p className="text-1xl font-bold"># of columns</p>
                <input
                    type="text"
                    value={columns}
                    onChange={handleColumnsChange}
                    className="mt-1 block w-full rounded border border-gray-800 px-3 py-2 mb-6"
                    inputMode="numeric"
                />
                {columnsError && (
                    <p className="text-red-500 text-sm">{columnsError}</p>
                )}

                <p className="text-1xl font-bold"># of pages</p>
                <input
                    type="text"
                    value={pages}
                    onChange={handlePagesChange}
                    className="mt-1 block w-full rounded border border-gray-800 px-3 py-2 mb-6"
                    inputMode="numeric"
                />
                {pagesError && (
                    <p className="text-red-500 text-sm">{pagesError}</p>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={files.length === 0 || loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400 mt-8"
                >
                    {loading ? "Generating..." : "Generate Cheat Sheet"}
                </button>

                {cheatSheet && (
                    <a
                        href={iframeSrcRef.current}
                        download={`cheat-sheet.pdf`}
                        className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400 mt-4 text-center"
                    >
                        Download
                    </a>
                )}
                {serverError && <p>{serverErrorMsg}</p>}
            </div>

            <div className="flex-grow">
                {cheatSheet ? (
                    <div className="mt-4">
                        <iframe
                            src={iframeSrcRef.current}
                            width="120%"
                            height="600px"
                            title="PDF Preview"
                        />
                    </div>
                ) : (
                    <div className="mt-4">
                        <p>PDF Preview (none)</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CheatSheet;
