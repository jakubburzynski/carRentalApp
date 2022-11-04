import { randomBytes } from "node:crypto";

export default function generateRandomToken(length: number): string {
    return randomBytes(length).toString("hex");
}
