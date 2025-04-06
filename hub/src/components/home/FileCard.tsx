import React, { useState, useRef } from "react";

interface Position {
    x: number;
    y: number;
}

interface FileCardProps {
    file: File;
    position: Position;
    zIndex: number;
    onSelect: () => void;
    onPositionChange: (newPosition: Position) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
    file,
    position,
    zIndex,
    onSelect,
    onPositionChange,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
    const cardRef = useRef<HTMLDivElement>(null);

    // Generate thumbnail URL
    const [thumbnailUrl, setThumbnailUrl] = useState<string>("");

    React.useEffect(() => {
        if (file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setThumbnailUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (cardRef.current) {
            setIsDragging(false); // Reset dragging state
            setIsDragging(true);
            const rect = cardRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            const newPosition = {
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y,
            };
            onPositionChange(newPosition);
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
        }
    };

    React.useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [isDragging]);

    const renderFilePreview = () => {
        if (file.type.startsWith("image/") && thumbnailUrl) {
            return (
                <img
                    src={thumbnailUrl}
                    alt={file.name}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "2px",
                        userSelect: "none", // Prevent image selection
                        pointerEvents: "none", // Ensure drag events pass through the image
                    }}
                />
            );
        } else if (file.type === "application/pdf") {
            return (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        backgroundColor: "#f5f5f5",
                        borderRadius: "2px",
                    }}
                >
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
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
                    <span style={{ fontSize: "10px", marginTop: "4px" }}>
                        PDF
                    </span>
                    <div
                        style={{
                            fontSize: "8px",
                            marginTop: "4px",
                            maxWidth: "90px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textAlign: "center",
                            fontWeight: "bold",
                        }}
                    >
                        {file.name}
                    </div>
                </div>
            );
        } else {
            return (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: "12px",
                        textAlign: "center",
                    }}
                >
                    {file.name}
                </div>
            );
        }
    };

    return (
        <div
            ref={cardRef}
            style={{
                position: "absolute",
                left: position.x,
                top: position.y,
                zIndex,
                cursor: isDragging ? "grabbing" : "grab",
                backgroundColor: "white",
                padding: "8px",
                borderRadius: "4px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                width: "100px",
                height: "100px",
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onClick={onSelect}
        >
            {renderFilePreview()}
        </div>
    );
};
