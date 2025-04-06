import { authenticateUser } from "@/middlewares/auth";
import User from "@/models/User";
import express, { Request, Response } from "express";
import createHttpError from "http-errors";

const userRouter = express.Router();

/**
 * @api {get} /api/user
 * @apiDescription Get the authenticated user's information.
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

    res.status(200).json(user);
});

export default userRouter;
