import React, { useState, useRef, useEffect } from "react";
import { FileCard } from "./FileCard";
import { FileViewer } from "./FileViewer";
import axios from "axios";

import { FileWithPosition } from "@/types/file";
import { useAuth0 } from "@auth0/auth0-react";
import env from "@/utils/env";

type CanvasProps = {
    files: FileWithPosition[];
    setFiles: React.Dispatch<React.SetStateAction<FileWithPosition[]>>;
    maxZIndex: number;
    setMaxZIndex: React.Dispatch<React.SetStateAction<number>>;
};

const BACKEND_URL = env.VITE_BACKEND_URL;

export const Canvas: React.FC<CanvasProps> = ({
    files,
    setFiles,
    maxZIndex,
    setMaxZIndex,
}) => {
    const { getAccessTokenSilently } = useAuth0();

    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

            try {
                // Upload file to backend
                const formData = new FormData();
                formData.append("file", uploadedFile);
                formData.append("position", JSON.stringify(clickPosition));

                const token = await getAccessTokenSilently();

                const response = await axios.post(
                    `${BACKEND_URL}/api/canvas`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "multipart/form-data",
                        },
                    }
                );

                const fileUrl = response.data.fileUrl;

                const newFile: FileWithPosition = {
                    url: fileUrl,
                    fileType: uploadedFile.type,
                    position: {
                        x: clickPosition.x - 50, // Center the card on click
                        y: clickPosition.y - 50,
                    },
                    id: response.data.id,
                };

                setFiles((prev) => [...prev, newFile]);
            } catch (error) {
                console.error("File upload failed:", error);
                alert("Failed to upload file. Please try again.");
            }

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

    const handleCardSelect = (id: string) => {
        setSelectedFileId(id);
        setMaxZIndex((prev) => prev + 1);
    };

    const handleDelete = async () => {
        if (selectedFileId) {
            try {
                const token = await getAccessTokenSilently();

                await axios.delete(
                    `${BACKEND_URL}/api/canvas/${selectedFileId}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        withCredentials: true,
                    }
                );

                setFiles((prev) =>
                    prev.filter((file) => file.id !== selectedFileId)
                );
                setSelectedFileId(null);
            } catch (error) {
                console.error("Failed to delete file:", error);
                alert("Failed to delete file. Please try again.");
            }
        }
    };

    useEffect(() => {
        const saveFilePositions = async () => {
            try {
                const filePositions = files.map(({ id, position }) => ({
                    id,
                    position,
                }));

                const token = await getAccessTokenSilently();

                await axios.post(
                    "${BACKEND_URL}/api/canvas/update-positions",
                    { files: filePositions },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        withCredentials: true,
                    }
                );
            } catch (error) {
                console.error("Failed to save file positions:", error);
            }
        };

        const intervalId = setInterval(saveFilePositions, 5000); // Save every 5 seconds

        return () => {
            clearInterval(intervalId); // Cleanup on component unmount
            saveFilePositions(); // Save one last time on unmount
        };
    }, [files]);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const token = await getAccessTokenSilently();

                const response = await axios.get("${BACKEND_URL}/api/canvas", {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    withCredentials: true,
                });

                const fetchedFiles = response.data.files.map(
                    (file: {
                        _id: string;
                        position: { x: number; y: number };
                        url: string;
                        fileType: string;
                    }) => ({
                        id: file._id, // Map MongoDB's `_id` to `id`
                        url: file.url,
                        fileType: file.fileType,
                        position: file.position,
                    })
                );
                setFiles(fetchedFiles);
            } catch (error) {
                console.error("Failed to fetch files:", error);
            }
        };

        fetchFiles();
    }, [setFiles]);

    return (
        <div
            className="flex flex-grow h-full bottom-0 items-center justify-center"
            onClick={handleCanvasClick}
        >
            {files.length === 0 && (
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
                    url={fileData.url}
                    fileType={fileData.fileType}
                    position={fileData.position}
                    zIndex={
                        selectedFileId === fileData.id ? maxZIndex : index + 1
                    }
                    onSelect={() => handleCardSelect(fileData.id)}
                    onPositionChange={(newPos) =>
                        handlePositionChange(fileData.id, newPos)
                    }
                />
            ))}

            <FileViewer
                file={
                    selectedFileId
                        ? {
                              url:
                                  files.find(
                                      (file) => file.id === selectedFileId
                                  )?.url || "",
                              fileType:
                                  files.find(
                                      (file) => file.id === selectedFileId
                                  )?.fileType || "",
                              fileName: `File-${selectedFileId}`, // Use a placeholder name or fetch from backend if available
                          }
                        : null
                }
                onClose={() => setSelectedFileId(null)}
                onDelete={handleDelete}
            />
        </div>
    );
};
