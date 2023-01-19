import { Type } from "@sinclair/typebox";

import { FastifyValidationSchema } from "../../loaders/fastify";
import passwordRegex from "../../utils/passwordRegex.util";

export const postRegisterRentalManagerSchema = {
    body: Type.Object({
        name: Type.String({ minLength: 3 }),
        email: Type.String({ format: "email" }),
        password: Type.RegEx(passwordRegex),
        rentalUuid: Type.String({ format: "uuid" }),
    }),
    response: {
        201: Type.Object({
            uuid: Type.String({ format: "uuid" }),
            name: Type.String(),
            email: Type.String({ format: "email" }),
        }),
    },
} satisfies FastifyValidationSchema;

export const patchRentalManagerSchema = {
    body: Type.Tuple([
        Type.Object({
            op: Type.Literal("replace"),
            path: Type.Literal("/active"),
            value: Type.Literal(true),
        }),
    ]),
    params: Type.Object({
        uuid: Type.String({ format: "uuid" }),
    }),
    querystring: Type.Object({
        token: Type.String({ minLength: 32, maxLength: 32 }),
    }),
    response: {
        204: Type.Null(),
    },
} satisfies FastifyValidationSchema;
