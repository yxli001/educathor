import "module-alias/register";
import "dotenv/config";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import fsx from "fs-extra";
import path from "path";
import axios from "axios";
import pdfParse from "pdf-parse";
import PDFDocument from "pdfkit";
import env from "./utils/env";
import errorHandler from "./middlewares/errorHandler";
import Tesseract from "tesseract.js";

import { GoogleGenAI } from "@google/genai";
import userRouter from "./routes/user";
import { exec } from "child_process";

const app = express();

app.use(express.json());
app.use(
    cors({
        origin: env.FRONTEND_ORIGIN, // allow frontend dev server
        credentials: true,
    })
);

const upload = multer({ dest: "uploads/" });

const connectDB = async () => {
    try {
        await mongoose.connect(env.MONGODB_URI);

        console.log("✅ Connected to MongoDB");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// CHEET SHEET BACKEND
const extractPdfText = async (pdfPath: string): Promise<string> => {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    return pdfData.text;
};
const queryGeminiLatex = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents:
                "Without explanation, concisely summarize the following text and generate LaTeX containing the concise facts into 1 page: " +
                text,
        });

        return response.text!;
    } catch (error) {
        console.error("Error calling Gemini AI:", error);
        throw new Error("Error generating cheat sheet.");
    }
};
const generatePdfFromLatex = async (latexCode: string, fileName: string) => {
    const tempDir = path.join(__dirname, "/../tmp");
    const texFile = path.join(tempDir, `${fileName}.tex`);
    const pdfFile = path.join(tempDir, `${fileName}.pdf`);

    await fsx.ensureDir(tempDir);
    await fsx.writeFile(texFile, latexCode);

    console.log("BRUHHHH");

    // Run pdflatex
    await new Promise<void>((resolve, reject) => {
        exec(
            `pdflatex -interaction=nonstopmode -output-directory=${tempDir} ${texFile}`,
            (err, stdout, stderr) => {
                if (err) {
                    console.error("LaTeX compilation error:", stderr);
                    reject(stderr);
                } else {
                    console.log("PDF THING RESOLVED");
                    resolve();
                }
            }
        );
    });

    console.log("BRUHHHH 2222");

    const pdfBuffer = await fsx.readFile(pdfFile);
    await fsx.remove(texFile);
    await fsx.remove(pdfFile);
    await fsx.remove(path.join(tempDir, `${fileName}.aux`));
    await fsx.remove(path.join(tempDir, `${fileName}.log`));
    return pdfBuffer;
};
app.post(
    "/api/cheatsheet",
    upload.array("files"),
    async (req: Request, res: Response): Promise<void> => {
        if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
            res.status(400).send("No files uploaded.");
            return;
        }
        try {
            // Extract text from each uploaded PDF file
            const texts: string[] = [];
            for (const file of req.files as Express.Multer.File[]) {
                const pdfPath = path.join(
                    "__dirname/../uploads/",
                    file.filename
                );
                const text = await extractPdfText(pdfPath);

                texts.push(text);
                fs.unlinkSync(pdfPath); // Clean up
            }
            const combinedText = texts.join("\n"); // combine all text into one

            const latex = await queryGeminiLatex(combinedText);
            console.log("generated latex");
            const pdfBuffer = await generatePdfFromLatex(
                latex,
                `cheatsheet_${Date.now()}`
            );
            console.log("pdf bugger");

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=cheatsheet.pdf"
            );
            res.send(pdfBuffer);
        } catch (err) {
            console.error("Error generating cheat sheet:", err);
            res.status(500).send("Error while generating cheat sheet.");
        }
    }
);

// MINDMAPPER BACKEND USING OCR
const extractTextFromImage = async (imagePath: string): Promise<string> => {
    const result = await Tesseract.recognize(imagePath, "eng");
    return result.data.text;
};

const queryGeminiWithText = async (
    text: string,
    mode: string
): Promise<string> => {
    const prompt =
        mode === "mindmap"
            ? `Convert these notes into a structured mind map:\n\n${text}`
            : `Summarize the following notes into bullet points:\n\n${text}`;

    const response = await axios.post(
        GEMINI_API_URL,
        {
            contents: [{ parts: [{ text: prompt }] }],
        },
        {
            headers: { "Content-Type": "application/json" },
        }
    );

    return (
        response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No output returned."
    );
};

const generatePdfFromText = (text: string, outputPath: string) => {
    return new Promise<void>((resolve) => {
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);
        doc.fontSize(12).text(text, { align: "left" });
        doc.end();
        writeStream.on("finish", resolve);
    });
};

app.post(
    "/api/analyze",
    upload.single("image"),
    async (req: Request, res: Response): Promise<void> => {
        const mode = req.body.mode;
        const file = req.file;

        if (!file || !mode) {
            res.status(400).send("Missing file or mode.");
            return;
        }

        const inputImagePath = path.join(
            __dirname,
            "../uploads",
            file.filename
        );
        const outputPdfPath = path.join(__dirname, "output.pdf");

        try {
            const extractedText = await extractTextFromImage(inputImagePath);
            const geminiResponse = await queryGeminiWithText(
                extractedText,
                mode
            );
            await generatePdfFromText(geminiResponse, outputPdfPath);

            res.download(outputPdfPath, "output.pdf", () => {
                fs.unlinkSync(inputImagePath);
                fs.unlinkSync(outputPdfPath);
            });
        } catch (err) {
            console.error("Failed to generate MINDMAPPER:", err);
            res.status(500).send("Error generating content.");
        }
    }
);

app.use("/api/user", userRouter);

app.use(errorHandler);

// Start the server on port 5174
const PORT = env.PORT;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
