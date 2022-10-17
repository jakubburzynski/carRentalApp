import { Static, Type } from "@sinclair/typebox";

export const postCreateRentalBody = Type.Object({
    name: Type.String({ minLength: 3 }),
    unitTypeId: Type.Number({ title: "Unit Type Id" }),
});

export type PostCreateRentalBody = Static<typeof postCreateRentalBody>;

export const postCreateRentalResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    name: Type.String(),
});

export type PostCreateRentalResponse = Static<typeof postCreateRentalResponse>;
