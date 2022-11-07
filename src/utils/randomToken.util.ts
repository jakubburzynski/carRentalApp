import { promisify } from "node:util";
import { randomBytes } from "node:crypto";

const randomBytesAsync = promisify(randomBytes);
export default async function generateRandomToken(
    expectedLength: number,
): Promise<string> {
    return (await randomBytesAsync((expectedLength * 6) / 8)).toString(
        "base64url",
    );
}
