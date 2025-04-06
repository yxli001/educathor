import React from "react";
// import { PdfFallback } from "./PdfFallback";

interface FileViewerProps {
    file: {
        url: string;
        fileType: string;
        fileName: string;
    } | null;
    onClose: () => void;
    onDelete: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
    file,
    onClose,
    onDelete,
}) => {
    if (!file) return null;

    const { url, fileType, fileName } = file;

    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div
            style={{
                position: "fixed",
                right: 0,
                top: 0,
                width: "40%",
                height: "100vh",
                backgroundColor: "white",
                boxShadow: "-2px 0 4px rgba(0,0,0,0.1)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h2>{fileName}</h2>
                <div>
                    <button
                        onClick={onDelete}
                        style={{
                            marginRight: "8px",
                            padding: "8px 16px",
                            backgroundColor: "#ff4444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        Delete
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: "#eeeeee",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {fileType.startsWith("image/") ? (
                <img
                    src={url}
                    alt={fileName}
                    style={{
                        maxWidth: "100%",
                        maxHeight: "calc(100vh - 100px)",
                        objectFit: "contain",
                    }}
                />
            ) : fileType === "application/pdf" ? (
                <div
                    style={{
                        flex: 1,
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <iframe
                        src={url}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            borderRadius: "4px",
                        }}
                        title={fileName}
                    />
                </div>
            ) : (
                <div>
                    <p>File type: {fileType || "Unknown"}</p>
                </div>
            )}

            <button
                onClick={handleDownload}
                style={{
                    padding: "10px 20px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "16px",
                }}
            >
                Download
            </button>
        </div>
    );
};
