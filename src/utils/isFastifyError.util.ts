import { FastifyError } from "fastify";

const isFastifyError = (err: unknown): err is FastifyError =>
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code.indexOf("FST_") === 0;

export default isFastifyError;
