import React from "react";

interface PdfFallbackProps {
    file: File;
    onDownload: () => void;
}

export const PdfFallback: React.FC<PdfFallbackProps> = ({
    file,
    onDownload,
}) => {
    return (
        <div
            style={{
                padding: "20px",
                backgroundColor: "#f8f9fa",
                border: "1px solid #dee2e6",
                borderRadius: "4px",
                textAlign: "center",
            }}
        >
            <div style={{ marginBottom: "20px" }}>
                <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ margin: "0 auto" }}
                >
                    <path
                        d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
                        stroke="#FF0000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M7 7H17"
                        stroke="#FF0000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M7 12H17"
                        stroke="#FF0000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M7 17H13"
                        stroke="#FF0000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <h3 style={{ marginBottom: "10px" }}>PDF Preview Unavailable</h3>
            <p style={{ marginBottom: "20px", color: "#6c757d" }}>
                We couldn't display this PDF file in the browser. You can
                download it instead.
            </p>
            <div style={{ marginBottom: "15px" }}>
                <p>
                    <strong>File:</strong> {file.name}
                </p>
                <p>
                    <strong>Size:</strong> {Math.round(file.size / 1024)} KB
                </p>
                <p>
                    <strong>Type:</strong> {file.type || "application/pdf"}
                </p>
            </div>
            <button
                onClick={onDownload}
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
                Download PDF
            </button>
        </div>
    );
};
