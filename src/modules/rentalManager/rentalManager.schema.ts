import { Static, Type } from "@sinclair/typebox";

import passwordRegex from "../../utils/passwordRegex.util";

export const postRegisterRentalManagerBody = Type.Object({
    name: Type.String({ minLength: 3 }),
    email: Type.String({ format: "email" }),
    password: Type.RegEx(passwordRegex),
    rentalUuid: Type.String({ format: "uuid" }),
});

export type PostRegisterRentalManagerBody = Static<
    typeof postRegisterRentalManagerBody
>;

export const postRegisterRentalManagerResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    name: Type.String(),
    email: Type.String({ format: "email" }),
});

export type PostRegisterRentalManagerResponse = Static<
    typeof postRegisterRentalManagerResponse
>;

export const patchRentalManagerBody = Type.Tuple([
    Type.Object({
        op: Type.Literal("replace"),
        path: Type.Literal("/active"),
        value: Type.Literal(true),
    }),
]);
export type PatchRentalManagerBody = Static<typeof patchRentalManagerBody>;

export const patchRentalManagerParams = Type.Object({
    uuid: Type.String({ format: "uuid" }),
});

export const patchRentalManagerQuery = Type.Object({
    token: Type.String({ minLength: 32, maxLength: 32 }),
});

export type PatchRentalManagerParams = Static<typeof patchRentalManagerParams>;
export type PatchRentalManagerQuery = Static<typeof patchRentalManagerQuery>;

export const patchRentalManagerResponse = Type.Null();

export type PatchRentalManagerResponse = Static<
    typeof patchRentalManagerResponse
>;
