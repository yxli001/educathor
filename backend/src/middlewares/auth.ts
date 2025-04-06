import env from "@/utils/env";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

const domain = env.AUTH0_DOMAIN; // e.g. dev-abc123.us.auth0.com
const audience = env.AUTH0_AUDIENCE; // e.g. https://educathor.api

const jwksClient = jwksRsa({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

/**
 * Verifies the JWT token from the request headers.
 */
export const authenticateUser = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
        next(createHttpError(401, "Missing Authorization token"));
        return;
    }

    jwt.verify(
        token,
        (header, cb) => {
            jwksClient.getSigningKey(header.kid, (err, key) => {
                if (err || !key) {
                    console.error("❌ Error getting signing key:", err);
                    return cb(err, undefined);
                }

                const signingKey = key.getPublicKey();

                cb(null, signingKey);
            });
        },
        {
            audience,
            issuer: `https://${domain}/`,
            algorithms: ["RS256"],
        },
        (err, decoded) => {
            console.log("Decoded JWT:", decoded); // ✅ confirm it's working
            if (err) {
                console.error("JWT verification error:", err);

                next(createHttpError(403, "Invalid or expired token"));
                return;
            }

            // ✅ Make sure decoded is an object and has `sub`
            if (
                typeof decoded === "string" ||
                !decoded ||
                typeof decoded.sub !== "string"
            ) {
                next(createHttpError(403, "Invalid token payload"));
                return;
            }

            console.log("Decoded JWT payload:", decoded); // ✅ confirm it's working

            req.user = {
                sub: decoded.sub,
                email: (decoded as JwtPayload).email,
                name: (decoded as JwtPayload).name,
                ...decoded,
            };

            next();
        }
    );
};
