import { Router } from "express";
import upload from "@/middlewares/upload";
import Tesseract from "tesseract.js";
import { env } from "process";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import path from "path";
import fs from "fs";

const mindMapperRouter = Router();

const GEMINI_API_KEY = env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
mindMapperRouter.post("/", upload.single("image"), async (req, res) => {
    const mode = req.body.mode;
    const file = req.file;

    if (!file || !mode) {
        res.status(400).send("Missing file or mode.");
        return;
    }

    const inputImagePath = path.resolve("uploads", file.filename);

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

export default mindMapperRouter;
