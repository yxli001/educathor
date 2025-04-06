import { authenticateUser } from "@/middlewares/auth";
import User from "@/models/User";
import express, { Request, Response } from "express";

const userRouter = express.Router();

/**
 * @api {get} /api/user
 * @apiDescription Get the authenticated user's information, including chat history.
 */
userRouter.get("/", authenticateUser, async (req: Request, res: Response) => {
    const { sub, email, name, picture } = req.user!;

    let user = await User.findOne({ uid: sub });

    if (!user) {
        user = await User.create({
            uid: sub,
            email,
            name,
            picture,
        });
    }

    // Include chat history in the response
    res.status(200).json({
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        chatHistory: user.chatHistory,
    });
});

export default userRouter;
