import fp from "fastify-plugin";
import { Static, Type } from "@sinclair/typebox";
import { envSchema } from "env-schema";
import { FastifyPluginAsync } from "fastify";

const initialEnvSchema = Type.Object({
    DATABASE_URL: Type.String(),
    SENDGRID_API_KEY: Type.String(),
    SENDGRID_SENDER_ADDRESS: Type.String(),
    SENDGRID_SENDER_NAME: Type.String(),
    SERVER_PORT: Type.Number({ default: 3000 }),
    SERVER_HOST: Type.String({ default: "localhost" }),
    SERVER_HTTPS: Type.Boolean({ default: false }),
});
type InitialEnvSchema = Static<typeof initialEnvSchema>;
const initialEnvConfig = envSchema<InitialEnvSchema>({
    schema: initialEnvSchema,
    dotenv: true,
});

function buildBaseUrl(): string {
    const protocol = initialEnvConfig.SERVER_HTTPS ? "https" : "http";
    const port =
        initialEnvConfig.SERVER_PORT === 80 ||
        initialEnvConfig.SERVER_PORT === 443
            ? ""
            : `:${initialEnvConfig.SERVER_PORT}`;
    return `${protocol}://${initialEnvConfig.SERVER_HOST}${port}`;
}

export type EnvConfig = InitialEnvSchema & { SERVER_BASE_URL: string };
const envConfig: EnvConfig = {
    ...initialEnvConfig,
    SERVER_BASE_URL: buildBaseUrl(),
};

const envPlugin: FastifyPluginAsync = async (server) => {
    server.decorate("config", envConfig);
};

export default fp(envPlugin);
