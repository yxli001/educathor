import "module-alias/register";
import "dotenv/config";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import env from "./utils/env";
import errorHandler from "./middlewares/errorHandler";

import userRouter from "./routes/user";
import geminiRouter from "./routes/gemini";
import mindMapperRouter from "./routes/mindmapper";
import cheatSheetRouter from "./routes/cheatsheet";

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

app.use("/api/user", userRouter);
app.use("/api/gemini", geminiRouter);
app.use("/api/mindmapper", mindMapperRouter);
app.use("/api/cheatsheet", cheatSheetRouter);

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
