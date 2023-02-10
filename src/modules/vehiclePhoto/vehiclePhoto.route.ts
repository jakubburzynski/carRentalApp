import { MultipartFile } from "@fastify/multipart";
import bytes from "bytes";

import {
    deleteVehiclePhoto,
    updateVehiclePhotoPosition,
    uploadVehiclePhoto,
} from "./vehiclePhoto.service";
import isFastifyError from "../../utils/isFastifyError.util";
import { ProcessingException } from "../../utils/processingException.util";
import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import {
    patchUpdateVehiclePhotoPositionSchema,
    postUploadVehiclePhotoSchema,
    deleteVehiclePhotoSchema,
} from "./vehiclePhoto.schema";

export default async function vehiclePhotoRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.post(
        "/:uuid/photos",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: postUploadVehiclePhotoSchema,
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

    server.patch(
        "/:vehicleUuid/photos/:photoUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: patchUpdateVehiclePhotoPositionSchema,
        },
        async (request, reply) => {
            const updatedPhoto = await updateVehiclePhotoPosition(
                request.params.vehicleUuid,
                request.params.photoUuid,
                request.session.rental.uuid,
                request.body.position,
            );
            return reply.status(200).send(updatedPhoto);
        },
    );

    server.delete(
        "/:vehicleUuid/photos/:photoUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: deleteVehiclePhotoSchema,
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
