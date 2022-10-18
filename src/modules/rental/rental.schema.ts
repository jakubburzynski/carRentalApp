import { Static, Type } from "@sinclair/typebox";

export const postCreateRentalBody = Type.Object({
    name: Type.String({ minLength: 3 }),
    unitTypeUuid: Type.String({ format: "uuid" }),
});

export type PostCreateRentalBody = Static<typeof postCreateRentalBody>;

export const postCreateRentalResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    name: Type.String(),
});

export type PostCreateRentalResponse = Static<typeof postCreateRentalResponse>;
