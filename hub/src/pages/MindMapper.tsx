import {
    useState,
    useRef,
    useEffect,
    useCallback,
    MouseEvent,
    KeyboardEvent,
} from "react";
import axios from "axios";
import jsPDF from "jspdf";
import ReactFlow, {
    Background,
    Controls,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    NodeProps,
    Handle,
    Position,
    OnConnect,
    addEdge,
    Connection,
    ReactFlowInstance,
    EdgeMouseHandler,
    NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import { MarkerType } from "reactflow";
import env from "@/utils/env";

type MindMapNode = {
    title: string;
    ideas?: Record<string, MindMapNode>;
};

const BACKEND_URL = env.VITE_BACKEND_URL;

const EditableNode = ({ id, data }: NodeProps) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(data.label);

    return (
        <>
            <div
                className="bg-yellow-100 border border-gray-400 rounded p-2 text-sm text-center"
                onDoubleClick={() => setEditing(true)}
            >
                {editing ? (
                    <input
                        className="text-sm w-full"
                        value={value}
                        autoFocus
                        onBlur={() => {
                            setEditing(false);
                            data.onUpdate(id, value);
                        }}
                        onChange={(e) => setValue(e.target.value)}
                    />
                ) : (
                    <span>{value}</span>
                )}
                <Handle type="target" position={Position.Left} />
                <Handle type="source" position={Position.Right} />
            </div>
        </>
    );
};

const nodeTypes = {
    editable: EditableNode,
};

export default function MindMapper() {
    const [file, setFile] = useState<File | null>(null);
    const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
    const [summaryText, setSummaryText] = useState<string | null>(null);
    const [loadingMode, setLoadingMode] = useState<
        "mindmap" | "summary" | null
    >(null);
    const mindMapRef = useRef<HTMLDivElement>(null);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] =
        useState<ReactFlowInstance | null>(null);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);

    const handleUpload = async (mode: "mindmap" | "summary") => {
        if (!file) return;
        setLoadingMode(mode);
        setMindMapData(null);
        setSummaryText(null);
        setNodes([]);
        setEdges([]);

        const formData = new FormData();
        formData.append("image", file);
        formData.append("mode", mode);

        try {
            const response = await axios.post(
                `${BACKEND_URL}/api/mindmapper`,
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                }
            );

            if (mode === "mindmap" && response.data?.type === "mindmap") {
                setMindMapData(response.data.data);
            } else if (
                mode === "summary" &&
                response.data?.type === "summary"
            ) {
                setSummaryText(response.data.data);
            }
        } catch (err) {
            console.error("Upload failed:", err);
        } finally {
            setLoadingMode(null);
        }
    };

    const handleNodeLabelUpdate = useCallback(
        (id: string, newLabel: string) => {
            setNodes((nds) =>
                nds.map((node) =>
                    node.id === id
                        ? {
                              ...node,
                              data: {
                                  ...node.data,
                                  label: newLabel,
                                  onUpdate: handleNodeLabelUpdate,
                              },
                          }
                        : node
                )
            );
        },
        [setNodes]
    );

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
                type: "editable",
                data: {
                    label: node.title,
                    onUpdate: handleNodeLabelUpdate,
                },
                position: { x, y },
            });

            if (parentId) {
                newEdges.push({
                    id: `${parentId}->${id}`,
                    source: parentId,
                    target: id,
                    type: "smoothstep",
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 20,
                        height: 20,
                    },
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
    }, [mindMapData, handleNodeLabelUpdate]);

    const downloadSummaryPDF = () => {
        if (!summaryText) return;
        const pdf = new jsPDF();
        const lines = pdf.splitTextToSize(summaryText, 180);
        pdf.text(lines, 10, 10);
        pdf.save("summary.pdf");
    };

    const downloadMindMapPDF = async () => {
        if (!mindMapRef.current) return;

        const container = mindMapRef.current.querySelector(".react-flow");
        if (!container) return;

        try {
            const dataUrl = await toPng(container as HTMLElement, {
                backgroundColor: "#ffffff",
                cacheBust: true,
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

    const onConnect: OnConnect = useCallback(
        (connection: Connection) =>
            setEdges((eds) =>
                addEdge({ ...connection, type: "smoothstep" }, eds)
            ),
        [setEdges]
    );

    const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
        setSelectedEdge(edge.id);
    };

    const onPaneClick = (event: MouseEvent) => {
        if (!reactFlowWrapper.current || !reactFlowInstance) return;

        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.project({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        });

        const newNodeId = `node-${Date.now()}`;
        const newNode: Node = {
            id: newNodeId,
            type: "editable",
            data: { label: "New Node", onUpdate: handleNodeLabelUpdate },
            position,
        };

        setNodes((nds) => [...nds, newNode]);

        if (selectedNode) {
            const newEdge: Edge = {
                id: `${selectedNode}->${newNodeId}`,
                source: selectedNode,
                target: newNodeId,
                type: "smoothstep",
            };
            setEdges((eds) => [...eds, newEdge]);
        }
    };

    const onNodeClick: NodeMouseHandler = (_event, node) => {
        setSelectedNode(node.id);
        setSelectedEdge(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Delete" && selectedEdge) {
            setEdges((eds) => eds.filter((e) => e.id !== selectedEdge));
            setSelectedEdge(null);
        }
    };

    return (
        <ReactFlowProvider>
            <style>{`.react-flow svg { overflow: visible; }`}</style>
            <div
                className="p-6 max-w-7xl mx-auto"
                ref={reactFlowWrapper}
                tabIndex={0}
                onKeyDown={onKeyDown}
            >
                <h1 className="text-2xl font-bold mb-4">MindMapper</h1>

                <label className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-800 rounded-md shadow-sm hover:bg-gray-200 text-sm cursor-pointer mb-4 w-fit">
                    <span className="mr-2">Upload PNG/JPG</span>
                    <input
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setFile(e.target.files[0]);
                                setMindMapData(null);
                                setSummaryText(null);
                                setSelectedNode(null);
                                setSelectedEdge(null);
                            }
                        }}
                        className="hidden"
                    />
                </label>

                {file && (
                    <>
                        <p className="text-sm text-gray-600 mb-2">
                            Selected: {file.name}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4 items-center">
                            <button
                                onClick={() => handleUpload("mindmap")}
                                className="bg-gray-800 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-700 transition"
                                disabled={loadingMode !== null}
                            >
                                {loadingMode === "mindmap"
                                    ? "Generating..."
                                    : "Mind Map"}
                            </button>

                            <button
                                onClick={() => handleUpload("summary")}
                                className="bg-gray-600 text-white text-sm px-3 py-1 rounded-md hover:bg-gray-500 transition"
                                disabled={loadingMode !== null}
                            >
                                {loadingMode === "summary"
                                    ? "Generating..."
                                    : "Summary"}
                            </button>
                        </div>
                    </>
                )}

                {nodes.length > 0 && (
                    <>
                        <div
                            ref={mindMapRef}
                            style={{
                                width: "100%",
                                height: "450px",
                                backgroundColor: "#f9fafb",
                                border: "1px solid #d1d5db",
                                borderRadius: "0.5rem",
                                marginBottom: "2rem",
                            }}
                        >
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onInit={setReactFlowInstance}
                                onPaneClick={onPaneClick}
                                onEdgeClick={onEdgeClick}
                                onNodeClick={onNodeClick}
                                nodeTypes={nodeTypes}
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
                                onClick={downloadMindMapPDF}
                                className="bg-purple-600 text-white px-6 py-3 rounded shadow"
                            >
                                Download Mind Map as PDF
                            </button>
                        </div>
                    </>
                )}

                {summaryText && (
                    <div className="bg-white border border-gray-300 rounded p-4 shadow mb-10 whitespace-pre-wrap">
                        <h2 className="text-xl font-semibold mb-2">
                            Bullet Point Summary
                        </h2>
                        <pre className="text-gray-800 text-sm">
                            {summaryText}
                        </pre>
                        <button
                            onClick={downloadSummaryPDF}
                            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded"
                        >
                            Download Summary as PDF
                        </button>
                    </div>
                )}
            </div>
        </ReactFlowProvider>
    );
}
