import React, { useState, useRef } from "react";
import { FileCard } from "./FileCard";
import { FileViewer } from "./FileViewer";

import { FileWithPosition } from "@/types/file";

type CanvasProps = {
    files: FileWithPosition[];
    setFiles: React.Dispatch<React.SetStateAction<FileWithPosition[]>>;
    maxZIndex: number;
    setMaxZIndex: React.Dispatch<React.SetStateAction<number>>;
};

export const Canvas: React.FC<CanvasProps> = ({
    files,
    setFiles,
    maxZIndex,
    setMaxZIndex,
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [clickPosition, setClickPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only handle clicks directly on the canvas, not on cards
        if (e.target === e.currentTarget && fileInputRef.current) {
            setClickPosition({ x: e.clientX, y: e.clientY });
            fileInputRef.current.click();
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile && clickPosition) {
            // Validate file type
            if (
                !uploadedFile.type.startsWith("image/") &&
                uploadedFile.type !== "application/pdf"
            ) {
                alert("Please upload an image or PDF file.");
                return;
            }

            const newFile: FileWithPosition = {
                file: uploadedFile,
                position: {
                    x: clickPosition.x - 50, // Center the card on click
                    y: clickPosition.y - 50,
                },
                id: Math.random().toString(36).substr(2, 9),
            };
            setFiles((prev) => [...prev, newFile]);
            // Reset input value to allow uploading the same file again
            e.target.value = "";
            setClickPosition(null);
        }
    };

    const handlePositionChange = (
        id: string,
        newPosition: { x: number; y: number }
    ) => {
        setFiles((prev) =>
            prev.map((file) =>
                file.id === id ? { ...file, position: newPosition } : file
            )
        );
    };

    const handleCardSelect = (file: File) => {
        setSelectedFile(file);
        setMaxZIndex((prev) => prev + 1);
    };

    const handleDelete = () => {
        if (selectedFile) {
            setFiles((prev) => prev.filter((f) => f.file !== selectedFile));
            setSelectedFile(null);
        }
    };

    return (
        <div
            className="flex flex-grow h-full bottom-0 items-center justify-center"
            onClick={handleCanvasClick}
        >
            {files.length == 0 && (
                <p
                    className="text-center text-4xl font-extrabold"
                    style={{ opacity: 0.3 }}
                >
                    This is your personal canvas. Click anywhere to get started!
                </p>
            )}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileUpload}
                accept="image/*,application/pdf"
            />

            {files.map((fileData, index) => (
                <FileCard
                    key={fileData.id}
                    file={fileData.file}
                    position={fileData.position}
                    zIndex={
                        selectedFile === fileData.file ? maxZIndex : index + 1
                    }
                    onSelect={() => handleCardSelect(fileData.file)}
                    onPositionChange={(newPos) =>
                        handlePositionChange(fileData.id, newPos)
                    }
                />
            ))}

            <FileViewer
                file={selectedFile}
                onClose={() => setSelectedFile(null)}
                onDelete={handleDelete}
            />
        </div>
    );
};
