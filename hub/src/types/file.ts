export interface FileWithPosition {
    url: string; // File URL
    fileType: string; // File type (e.g., "image/png", "application/pdf")
    position: { x: number; y: number };
    id: string;
}
