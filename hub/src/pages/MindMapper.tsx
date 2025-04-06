import { useState, useRef, useEffect } from "react";
import axios from "axios";
// import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
// ignorethisfornow @ts-expect-error chill
// import { saveAsPng } from "save-html-as-image";
// import { useReactFlow } from "reactflow";
// import { toPng } from "html-to-image";
import { toPng } from "html-to-image";

type MindMapNode = {
    title: string;
    ideas?: Record<string, MindMapNode>;
};

export default function MindMapper() {
    const [file, setFile] = useState<File | null>(null);
    const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
    const [loadingMode, setLoadingMode] = useState<
        "mindmap" | "summary" | null
    >(null);
    const mindMapRef = useRef<HTMLDivElement>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const handleUpload = async (mode: "mindmap" | "summary") => {
        if (!file) return;
        setLoadingMode(mode);
        setMindMapData(null);

        const formData = new FormData();
        formData.append("image", file);
        formData.append("mode", mode);

        try {
            const response = await axios.post(
                "http://localhost:5174/api/analyze",
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                }
            );

            if (mode === "mindmap" && response.data?.type === "mindmap") {
                setMindMapData(response.data.data);
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setLoadingMode(null);
        }
    };

    const convertMindMapToFlow = (root: MindMapNode) => {
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        const spreadAngle = 360;
        const radiusStep = 200;

        const traverse = (
            node: MindMapNode,
            id: string,
            parentId: string | null,
            level: number,
            index: number,
            siblingCount: number
        ) => {
            const angle =
                (index / siblingCount) * spreadAngle * (Math.PI / 180);
            const radius = level * radiusStep;
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);

            newNodes.push({
                id,
                data: { label: node.title },
                position: { x, y },
                style: {
                    padding: 10,
                    border: "1px solid #d1d5db",
                    borderRadius: "0.5rem",
                    background: "#fffbe6",
                    color: "#111827",
                    textAlign: "center",
                    width: 150,
                },
            });

            if (parentId) {
                newEdges.push({
                    id: `${parentId}->${id}`,
                    source: parentId,
                    target: id,
                    type: "smoothstep",
                });
            }

            if (node.ideas) {
                const children = Object.entries(node.ideas);
                children.forEach(([key, child], idx) => {
                    traverse(
                        child,
                        `${id}-${key}`,
                        id,
                        level + 1,
                        idx,
                        children.length
                    );
                });
            }
        };

        traverse(root, "root", null, 0, 0, 1);
        return { nodes: newNodes, edges: newEdges };
    };

    useEffect(() => {
        if (mindMapData) {
            const { nodes, edges } = convertMindMapToFlow(mindMapData);
            setNodes(nodes);
            setEdges(edges);
        }
    }, [mindMapData]);

    const downloadPDF = async () => {
        if (!mindMapRef.current) return;

        const container = mindMapRef.current.querySelector(".react-flow");

        if (!container) {
            console.error("React Flow container not found");
            return;
        }

        try {
            const dataUrl = await toPng(container as HTMLElement, {
                backgroundColor: "#ffffff",
                cacheBust: true,
                filter: (node) => {
                    // Prevent grid dots from disappearing
                    const id = (node as HTMLElement)?.className || "";
                    return !String(id).includes("react-flow__minimap");
                },
            });

            const img = new Image();
            img.src = dataUrl;

            img.onload = () => {
                const pdf = new jsPDF({
                    orientation: "landscape",
                    unit: "px",
                    format: [img.width, img.height],
                });

                pdf.addImage({
                    imageData: dataUrl,
                    format: "PNG",
                    x: 0,
                    y: 0,
                    width: img.width,
                    height: img.height,
                });

                pdf.save("mindmap.pdf");
            };
        } catch (err) {
            console.error("PDF generation failed:", err);
        }
    };

    return (
        <ReactFlowProvider>
            <div className="p-6 max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">MindMapper Upload</h1>

                <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                            setFile(e.target.files[0]);
                            setMindMapData(null);
                        }
                    }}
                    className={`px-4 py-2 rounded ${
                        file
                            ? "bg-blue-400 hover:bg-blue-500"
                            : "bg-blue-200 hover:bg-blue-300"
                    } text-black mb-6`}
                />
                {file && (
                    <p className="text-sm text-gray-600 mb-2">
                        Selected: {file.name}
                    </p>
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
                                : "Generate Mind Map"}
                        </button>
                    </div>
                )}

                {nodes.length > 0 && (
                    <>
                        <div
                            ref={mindMapRef}
                            style={{
                                width: "100%",
                                height: "500px", // ⬅️ Smaller height for visibility
                                backgroundColor: "#f9fafb",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.5rem",
                                marginBottom: "2rem",
                                overflow: "hidden",
                            }}
                        >
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                fitView
                                panOnDrag
                                zoomOnScroll
                                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                            >
                                <Background />
                                <Controls />
                            </ReactFlow>
                        </div>

                        <div className="text-center mb-10">
                            <button
                                onClick={downloadPDF}
                                className="bg-purple-600 text-white px-6 py-3 rounded shadow"
                            >
                                Download Spiderweb Mind Map as PDF
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ReactFlowProvider>
    );
}
