import { GoogleGenAI } from "@google/genai";
import { Router, Request, Response } from "express";
import { env } from "process";
import Tesseract from "tesseract.js";
import fs from "fs";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import fsx from "fs-extra";
import PDFDocument from "pdfkit";
import { exec } from "child_process";
import upload from "@/middlewares/upload";
import path from "path";
import latex from "node-latex";

const cheatSheetRouter = Router();

const GEMINI_API_KEY = env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// CHEET SHEET BACKEND
const extractImgText = async (imagePath: string): Promise<string> => {
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
function wrapExponentsOutsideMathMode(input: string): string {
    let result = "";
    let inMath = false;
    let i = 0;

    while (i < input.length) {
        if (input[i] === "$") {
            inMath = !inMath;
            result += "$";
            i++;
            continue;
        }

        if (!inMath) {
            // Try to match something like: a^10
            const match = input.slice(i).match(/^([a-zA-Z])\^(\d+)/);
            if (match) {
                const [fullMatch, base, exponent] = match;
                result += `$${base}^${exponent}$`;
                i += fullMatch.length;
                continue;
            }
        }

        result += input[i];
        i++;
    }

    return result;
}
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
    const prompt = `Format this LaTeX code to have ${columns} column(s) and ensure that margins, line spacing, and font size is small so that it fits in ${pages} page(s). Also ensure that all math control sequences are properly closed: \n`;
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

        latexCode = latexCode.replace(/\0/g, ""); // removes all null terminators

        const packages = [
            "\\usepackage{amsmath}",
            "\\usepackage{amsfonts}",
            "\\usepackage{enumitem}",
            "\\usepackage{amssymb}",
        ];
        let lines = latexCode.split("\n"); // add packages it may have forgotten
        lines.splice(1, 0, ...packages);
        latexCode = lines.join("\n");

        latexCode = wrapExponentsOutsideMathMode(latexCode); // deal with exponents outside of math mode
        return latexCode;
    } catch (error) {
        console.error("Error calling Gemini AI:", error);
        throw new Error("Error refining cheat sheet.");
    }
};
const generatePdfFromLatexWithExec = async (
    // UNUSED, DO NOT USE THIS, BAD CODE, WONT WORK ON ALL DEVICES
    latexCode: string,
    fileName: string
) => {
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

const generatePdfFromLatex = async (latexCode: string, fileName: string) => {
    // THIS ONE IS BETTER, LEAVES NO TRACE AND WORKS ON ALL DEVICES
    return new Promise((resolve, reject) => {
        const pdfStream = latex(latexCode);

        const chunks: Buffer[] = [];

        pdfStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        pdfStream.on("error", reject);
        pdfStream.on("end", () => resolve(Buffer.concat(chunks)));
    });
};

cheatSheetRouter.post(
    "/",
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
                    const text = await extractImgText(filePath);
                    texts.push(text);
                }
                fs.unlinkSync(filePath); // Clean up
            }
            const combinedText = texts.join("\n"); // combine all text into one

            const latex = await queryGeminiLatex(combinedText);
            console.log("generated latex");
            const latexRefined = await refineLatex(latex, columns, pages);
            console.log("refined latex");

            /*
            const tempDir = path.join(__dirname, "/../../tmp");
            const texFile = path.join(tempDir, `temp.tex`);
            await fsx.ensureDir(tempDir);
            await fsx.writeFile(texFile, latexRefined);*/

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

export default cheatSheetRouter;
