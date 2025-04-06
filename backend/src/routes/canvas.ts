import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import User from "@/models/User";
import { authenticateUser } from "@/middlewares/auth";
import createHttpError from "http-errors";
import { storage } from "@/lib/firebase";

const canvasRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

canvasRouter.post(
    "/",
    authenticateUser,
    upload.single("file"),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { position } = req.body;

            if (!position) {
                next(createHttpError(400, "Position is required"));
                return;
            }

            const { x, y } = JSON.parse(position);

            if (!req.file) {
                next(createHttpError(400, "File is required"));
                return;
            }

            const bucket = storage.bucket();
            const fileName = `uploads/${Date.now()}_${req.file.originalname}`;
            const file = bucket.file(fileName);

            await file.save(req.file.buffer, {
                metadata: {
                    contentType: req.file.mimetype,
                },
            });

            const fileUrl = await file.getSignedUrl({
                action: "read",
                expires: "03-01-2500", // Set a far future expiration date
            });

            // Save file URL, fileType, and position to the user's files
            const updatedUser = await User.findOneAndUpdate(
                { uid: req.user!.sub },
                {
                    $push: {
                        files: {
                            url: fileUrl[0],
                            fileType: req.file.mimetype, // Save fileType
                            position: {
                                x,
                                y,
                            },
                        },
                    },
                },
                { new: true, projection: { files: { $slice: -1 } } } // Return only the newly added file
            );

            const newFile = updatedUser?.files[0]; // Get the newly added file

            res.status(200).json({ fileUrl: fileUrl[0], id: newFile?._id });
        } catch (error) {
            console.error("File upload error:", error);
            res.status(500).json({ error: "Failed to upload file" });
        }
    }
);

canvasRouter.get(
    "/",
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await User.findOne({ uid: req.user!.sub }).select(
                "files"
            );

            if (!user) {
                next(createHttpError(404, "User not found"));
                return;
            }

            res.status(200).json({ files: user.files });
        } catch (error) {
            console.error("Error retrieving files:", error);
            next(createHttpError(500, "Failed to retrieve files"));
        }
    }
);

canvasRouter.post(
    "/update-positions",
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { files } = req.body;
            if (!Array.isArray(files)) {
                next(createHttpError(400, "Files array is required"));
            }

            const updates = files.map(
                (file: { id: string; position: { x: number; y: number } }) => ({
                    updateOne: {
                        filter: { uid: req.user!.sub, "files._id": file.id },
                        update: { $set: { "files.$.position": file.position } },
                    },
                })
            );

            await User.bulkWrite(updates);

            res.status(200).json({
                message: "File positions updated successfully",
            });
        } catch (error) {
            console.error("Error updating file positions:", error);
            next(createHttpError(500, "Failed to update file positions"));
        }
    }
);

canvasRouter.delete(
    "/:fileId",
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { fileId } = req.params;

            const user = await User.findOne({ uid: req.user!.sub });

            if (!user) {
                next(createHttpError(404, "User not found"));
                return;
            }

            const file = user.files.id(fileId);

            if (!file) {
                next(createHttpError(404, "File not found"));
                return;
            }

            const bucket = storage.bucket();
            const fileName = file.url
                .split("/")
                .pop()
                ?.split("?")[0]
                .split("/")[1]; // Extract file name from URL

            if (fileName) {
                await bucket.file(`uploads/${fileName}`).delete(); // Delete file from Firebase
            }

            await file.deleteOne(); // Remove file from MongoDB
            await user.save();

            res.status(200).json({ message: "File deleted successfully" });
        } catch (error) {
            console.error("Error deleting file:", error);
            next(createHttpError(500, "Failed to delete file"));
        }
    }
);

export default canvasRouter;
