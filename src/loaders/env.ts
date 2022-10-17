import { Static, Type } from "@sinclair/typebox";

const envSchema = Type.Object({
    DATABASE_URL: Type.String(),
    PORT: Type.Number({ default: 3000 }),
    HOST: Type.String({ default: "0.0.0.0" }),
});

export type EnvSchema = Static<typeof envSchema>;

export default envSchema;
