import { InferSchemaType, Schema, model } from "mongoose";

const userSchema = new Schema({
    uid: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    name: { type: String },
    picture: { type: String },
    chatHistory: [
        {
            message: { type: String, required: true },
            sender: { type: String, enum: ["user", "bot"], required: true },
            timestamp: { type: Date, default: Date.now },
        },
    ],
});

type User = InferSchemaType<typeof userSchema>;

export default model<User>("User", userSchema);
