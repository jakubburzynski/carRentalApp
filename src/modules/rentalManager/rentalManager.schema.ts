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

export const putActivateRentalManagerBody = Type.Object({
    active: Type.Literal(true),
});

export const putActivateRentalManagerParams = Type.Object({
    uuid: Type.String({ format: "uuid" }),
});

export const putActivateRentalManagerQuery = Type.Object({
    token: Type.String({ minLength: 32, maxLength: 32 }),
});

export type PutActivateRentalManagerBody = Static<
    typeof putActivateRentalManagerBody
>;
export type PutActivateRentalManagerParams = Static<
    typeof putActivateRentalManagerParams
>;
export type PutActivateRentalManagerQuery = Static<
    typeof putActivateRentalManagerQuery
>;

export const putActivateRentalManagerResponse = Type.Null();

export type PutActivateRentalManagerResponse = Static<
    typeof putActivateRentalManagerResponse
>;
