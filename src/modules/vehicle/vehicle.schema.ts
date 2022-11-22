import { Static, Type } from "@sinclair/typebox";

export const postCreateVehicleBody = Type.Object({
    brand: Type.String({ minLength: 2 }),
    model: Type.String({ minLength: 1 }),
    year: Type.Number({ minimum: 1900, maximum: new Date().getFullYear() + 1 }),
    description: Type.Optional(Type.String({ minLength: 3 })),
    mileage: Type.Number({ minimum: 1 }),
    licensePlate: Type.String({ minLength: 1, maxLength: 20 }),
    pricePerDay: Type.Number({ minimum: 1 }),
    name: Type.Optional(Type.String({ minLength: 3 })),
    rentalUuid: Type.String({ format: "uuid" }),
    fuelTypeUuid: Type.String({ format: "uuid" }),
});

export type PostCreateVehicleBody = Static<typeof postCreateVehicleBody>;

export const postCreateVehicleResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    name: Type.String(),
});

export type PostCreateVehicleResponse = Static<
    typeof postCreateVehicleResponse
>;

export const postUploadVehiclePhotoParams = Type.Object({
    uuid: Type.String({ format: "uuid" }),
});

export type PostUploadVehiclePhotoParams = Static<
    typeof postUploadVehiclePhotoParams
>;

export const postUploadVehiclePhotoResponse = Type.Object({
    uuid: Type.String({ format: "uuid" }),
    url: Type.String({ format: "uri" }),
    position: Type.Number(),
});
