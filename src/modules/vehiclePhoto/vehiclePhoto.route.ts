import { FastifyInstance } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import bytes from "bytes";

import {
    deleteVehiclePhotoParams,
    DeleteVehiclePhotoParams,
    deleteVehiclePhotoResponse,
    patchUpdateVehiclePhotoPositionBody,
    PatchUpdateVehiclePhotoPositionBody,
    patchUpdateVehiclePhotoPositionParams,
    PatchUpdateVehiclePhotoPositionParams,
    patchUpdateVehiclePhotoPositionResponse,
    postUploadVehiclePhotoParams,
    PostUploadVehiclePhotoParams,
    postUploadVehiclePhotoResponse,
} from "./vehiclePhoto.schema";
import {
    deleteVehiclePhoto,
    updateVehiclePhotoPosition,
    uploadVehiclePhoto,
} from "./vehiclePhoto.service";
import isFastifyError from "../../utils/isFastifyError.util";
import { ProcessingException } from "../../utils/processingException.util";

export default async function vehiclePhotoRoutes(server: FastifyInstance) {
    server.post<{
        Params: PostUploadVehiclePhotoParams;
    }>(
        "/:uuid/photos",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                params: postUploadVehiclePhotoParams,
                response: {
                    201: postUploadVehiclePhotoResponse,
                },
            },
        },
        async (request, reply) => {
            if (!request.isMultipart()) {
                throw new ProcessingException(
                    415,
                    "Request content type is not multipart",
                );
            }

            let photo: MultipartFile | undefined;
            try {
                photo = await request.file({
                    limits: {
                        fields: 0,
                        files: 1,
                        fileSize: bytes("2MB"),
                    },
                });
            } catch (err) {
                if (isFastifyError(err) && err.code === "FST_FIELDS_LIMIT") {
                    throw new ProcessingException(
                        400,
                        "Only allowed field type is photo",
                    );
                }

                throw err;
            }

            if (!photo) {
                throw new ProcessingException(400, "No vehicle photo uploaded");
            }

            if (photo.fieldname !== "photo") {
                throw new ProcessingException(
                    422,
                    "Vehicle photo should be attached to the 'photo' field",
                );
            }

            const vehiclePhoto = await uploadVehiclePhoto(
                request.params.uuid,
                request.session.rental.uuid,
                photo,
            );
            return reply.status(201).send(vehiclePhoto);
        },
    );

    server.patch<{
        Body: PatchUpdateVehiclePhotoPositionBody;
        Params: PatchUpdateVehiclePhotoPositionParams;
    }>(
        "/:vehicleUuid/photos/:photoUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                body: patchUpdateVehiclePhotoPositionBody,
                params: patchUpdateVehiclePhotoPositionParams,
                response: {
                    200: patchUpdateVehiclePhotoPositionResponse,
                },
            },
        },
        async (request, reply) => {
            const updatedPhoto = await updateVehiclePhotoPosition(
                request.params.vehicleUuid,
                request.params.photoUuid,
                request.session.rental.uuid,
                request.body[0].value,
            );
            return reply.status(200).send(updatedPhoto);
        },
    );

    server.delete<{ Params: DeleteVehiclePhotoParams }>(
        "/:vehicleUuid/photos/:photoUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                params: deleteVehiclePhotoParams,
                response: {
                    204: deleteVehiclePhotoResponse,
                },
            },
        },
        async (request, reply) => {
            await deleteVehiclePhoto(
                request.params.vehicleUuid,
                request.params.photoUuid,
                request.session.rental.uuid,
            );
            return reply.status(204).send();
        },
    );
}
