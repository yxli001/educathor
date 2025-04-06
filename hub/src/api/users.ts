import { User } from "@/types/user";
import { APIResult, get, handleAPIError } from "./requests";

export const getUser = async (token: string): Promise<APIResult<User>> => {
    try {
        const res = await get(
            "/api/user",
            {},
            {
                Authorization: `Bearer ${token}`,
            }
        );

        const user = (await res.json()) as User;

        return { success: true, data: user };
    } catch (error) {
        return handleAPIError(error);
    }
};
