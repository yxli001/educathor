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
    const prompt = `Modify this LaTeX code to have ${columns} column(s) and ensure that margins, line spacing, and font size is small so that it fits in ${pages} page(s): \n`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt + text,
        });

        let latexCode = response // get rid of Gemini's comments
            .text!.split("\n")
            .filter((line) => !line.startsWith("```"))
            .join("\n");

        const endString = "\\end{document}"; // get rid of more of Gemini's comments
        const index = latexCode.indexOf(endString);
        if (index !== -1) {
            latexCode = latexCode.substring(0, index + endString.length);
        }

        latexCode = latexCode.replace(/(?<=\s)&(?=\s)/g, "\\&"); // turns & into \&

        const packages = [
            "\\usepackage{amsmath}",
            "\\usepackage{amsfonts}",
            "\\usepackage{enumitem}",
        ];
        let lines = latexCode.split("\n"); // add packages it may have forgotten
        lines.splice(1, 0, ...packages);
        latexCode = lines.join("\n");

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
            const columns = req.body.columns;
            const pages = req.body.pages;

            // Extract text from each uploaded PDF file
            const texts: string[] = [];
            for (const file of req.files as Express.Multer.File[]) {
                const filePath = path.join(
                    "__dirname/../uploads/",
                    file.filename
                );
                if (file.mimetype == "application/pdf") {
                    const text = await extractPdfText(filePath);
                    texts.push(text);
                } else if (
                    file.mimetype ==
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ) {
                    const text = await extractDocxText(filePath);
                    texts.push(text);
                } else if (file.mimetype.startsWith("image")) {
                    const text = await ocrImageDocument(filePath);
                    texts.push(text);
                }
                fs.unlinkSync(filePath); // Clean up
            }
            const combinedText = texts.join("\n"); // combine all text into one

            const latex = await queryGeminiLatex(combinedText);
            console.log("generated latex");
            const latexRefined = await refineLatex(latex, columns, pages);
            console.log("refined latex");
            const pdfBuffer = await generatePdfFromLatex(
                latexRefined,
                `cheatsheet_${Date.now()}`
            );
            console.log("pdf created");

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
    const result = await Tesseract.recognize(imagePath, "eng", {
        logger: (m: { status: string; progress: number }) => console.log(m),
        // bypass TS restriction
        params: {
            tessedit_char_whitelist:
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-–()[]{}",
        },
    } as any);
    return result.data.text;
};

const queryGeminiToMindMapNodes = async (text: string): Promise<any> => {
    const prompt = `Extract key ideas from the following text as mind map nodes in JSON using the MindMup MapJS format. If you are unsure of the main topic, set it to "Mind Mapper"
  
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

const queryGeminiBulletSummary = async (text: string): Promise<string> => {
    const prompt = `Summarize the following content into concise bullet points. Use clear indentation, numbering, and formatting:
  
  ${text}
  
  Return only plain text.`;

    const response = await axios.post(
        GEMINI_API_URL,
        {
            contents: [{ parts: [{ text: prompt }] }],
        },
        {
            headers: { "Content-Type": "application/json" },
        }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text.trim();
};

// Route
app.post("/api/analyze", upload.single("image"), async (req, res) => {
    const mode = req.body.mode;
    const file = req.file;

    if (!file || !mode) {
        res.status(400).send("Missing file or mode.");
        return;
    }

    const inputImagePath = path.join(__dirname, "../uploads", file.filename);

    try {
        const extractedText = await extractTextFromImage(inputImagePath);

        if (mode === "summary") {
            const summary = await queryGeminiBulletSummary(extractedText);
            fs.unlinkSync(inputImagePath);
            res.json({ type: "summary", data: summary });
            return;
        }

        if (mode === "mindmap") {
            const mindMapJson = await queryGeminiToMindMapNodes(extractedText);
            fs.unlinkSync(inputImagePath);
            res.json({ type: "mindmap", data: mindMapJson });
            return;
        }

        fs.unlinkSync(inputImagePath);
        res.status(400).send("Invalid mode.");
    } catch (err) {
        console.error("Failed to generate content:", err);
        res.status(500).send("Error generating content.");
    }
});

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
