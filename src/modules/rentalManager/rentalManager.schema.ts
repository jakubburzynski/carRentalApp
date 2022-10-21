import { Static, Type } from "@sinclair/typebox";

import passwordRegex from "../../utils/passwordRegex.util";

export const postRegisterRentalManagerBody = Type.Object({
    name: Type.String({ minLength: 3 }),
    email: Type.String({ format: "email" }),
    password: Type.RegEx(passwordRegex, {}),
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
