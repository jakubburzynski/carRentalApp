import { Static, Type } from "@sinclair/typebox";

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

export const deleteVehiclePhotoParams = Type.Object({
    vehicleUuid: Type.String({ format: "uuid" }),
    photoUuid: Type.String({ format: "uuid" }),
});

export type DeleteVehiclePhotoParams = Static<typeof deleteVehiclePhotoParams>;

export const deleteVehiclePhotoResponse = Type.Null();
