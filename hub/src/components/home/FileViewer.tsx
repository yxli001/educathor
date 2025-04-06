import React, { useState, useEffect } from "react";
import { PdfFallback } from "./PdfFallback";

interface FileViewerProps {
    file: File | null;
    onClose: () => void;
    onDelete: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
    file,
    onClose,
    onDelete,
}) => {
    const [fileUrl, setFileUrl] = useState<string>("");
    const [pdfError, setPdfError] = useState<string | null>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            setPdfError(null);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const handleDownload = () => {
        if (file) {
            const url = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    if (!file) return null;

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
                <h2>{file.name}</h2>
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

            {file.type.startsWith("image/") ? (
                <img
                    src={fileUrl}
                    alt={file.name}
                    style={{
                        maxWidth: "100%",
                        maxHeight: "calc(100vh - 100px)",
                        objectFit: "contain",
                    }}
                />
            ) : file.type === "application/pdf" ? (
                <div
                    style={{
                        flex: 1,
                        overflow: "hidden",
                        position: "relative",
                    }}
                >
                    <iframe
                        src={fileUrl}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            borderRadius: "4px",
                        }}
                        title={file.name}
                        onError={() => setPdfError("Failed to load PDF")}
                    />
                    {pdfError && (
                        <PdfFallback file={file} onDownload={handleDownload} />
                    )}
                </div>
            ) : (
                <div>
                    <p>File type: {file.type || "Unknown"}</p>
                    <p>Size: {Math.round(file.size / 1024)} KB</p>
                </div>
            )}
        </div>
    );
};
