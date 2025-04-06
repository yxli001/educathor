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
import mammoth from "mammoth";

import { GoogleGenAI } from "@google/genai";
import userRouter from "./routes/user";
import geminiRouter from "./routes/gemini";
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
const ocrImageDocument = async (imagePath: string): Promise<string> => {
    const result = await Tesseract.recognize(imagePath, "eng");
    return result.data.text;
};
const extractPdfText = async (pdfPath: string): Promise<string> => {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    return pdfData.text;
};
const extractDocxText = async (docPath: string): Promise<string> => {
    const data = await fs.promises.readFile(docPath);
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
};
const queryGeminiLatex = async (text: string): Promise<string> => {
    const prompt =
        "Create LaTeX code concisely summarizing the following information. Your raw output must be a compileable document, and you must use very small margins, line spacing, lists, and font size to cram everything into 1 page. Do not use math mode unless for equations: \n";
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt + text,
        });

        return response.text!;
    } catch (error) {
        console.error("Error calling Gemini AI:", error);
        throw new Error("Error generating cheat sheet.");
    }
};
const refineLatex = async (
    text: string,
    columns: number,
    pages: number
): Promise<string> => {
    const prompt = `Modify this LaTeX code to have ${columns} column(s) and ensure that it fits in ${pages} page(s): \n`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt + text,
        });

        const latexCode = response
            .text!.split("\n")
            .filter((line) => !line.startsWith("```"))
            .join("\n");

        const endString = "\\end{document}";
        const index = latexCode.indexOf(endString);
        if (index !== -1) {
            return latexCode.substring(0, index + endString.length);
        }

        return latexCode;
    } catch (error) {
        console.error("Error calling Gemini AI:", error);
        throw new Error("Error refining cheat sheet.");
    }
};
const generatePdfFromLatex = async (latexCode: string, fileName: string) => {
    const tempDir = path.join(__dirname, "/../tmp");
    const texFile = path.join(tempDir, `${fileName}.tex`);
    const pdfFile = path.join(tempDir, `${fileName}.pdf`);

    latexCode = latexCode
        .split("\n")
        .filter((line) => !line.startsWith("```"))
        .join("\n");

    console.log(latexCode);

    await fsx.ensureDir(tempDir);
    await fsx.writeFile(texFile, latexCode);

    // Run pdflatex
    await new Promise<void>((resolve, reject) => {
        exec(
            `pdflatex -interaction=nonstopmode -output-directory=${tempDir} ${texFile}`,
            (err, stdout, stderr) => {
                if (err) {
                    console.error("LaTeX compilation error:", stderr);
                    reject(stderr);
                } else {
                    resolve();
                }
            }
        );
    });

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

const queryGeminiToMindMapNodes = async (text: string): Promise<any> => {
    const prompt = `Extract key ideas from the following text as mind map nodes in JSON using the MindMup MapJS format.

Text:
${text}

Return only the JSON. Example format:
{
  "title": "Main Topic",
  "ideas": {
    "1": {
      "title": "Subtopic 1",
      "ideas": {
        "1": { "title": "Detail 1" },
        "2": { "title": "Detail 2" }
      }
    },
    "2": { "title": "Subtopic 2" }
  }
}`;

    const response = await axios.post(
        GEMINI_API_URL,
        {
            contents: [{ parts: [{ text: prompt }] }],
        },
        {
            headers: { "Content-Type": "application/json" },
        }
    );

    const rawText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleanedText = rawText.replace(/```(?:json)?\n?|```/g, "").trim();
    return JSON.parse(cleanedText);
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

        try {
            console.log("[STEP] Uploaded image path:", inputImagePath);
            const extractedText = await extractTextFromImage(inputImagePath);
            console.log("[STEP] Extracted text:", extractedText.slice(0, 200));

            const mindMapJson = await queryGeminiToMindMapNodes(extractedText);
            console.log("[STEP] Mind map JSON generated");

            fs.unlinkSync(inputImagePath);
            res.json({ type: "mindmap", data: mindMapJson });
        } catch (err) {
            console.error("Failed to generate MINDMAPPER:", err);
            res.status(500).send("Error generating content.");
        }
    }
);

app.use("/api/user", userRouter);
app.use("/api/gemini", geminiRouter);

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
