import { Static, Type } from "@sinclair/typebox";

export const postLoginRentalManagerBody = Type.Object({
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 1 }),
});

export type PostLoginRentalManagerBody = Static<
    typeof postLoginRentalManagerBody
>;

export const postLoginRentalManagerResponse = Type.Null();

export type PostLoginRentalManagerResponse = Static<
    typeof postLoginRentalManagerResponse
>;
