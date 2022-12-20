import { FastifyInstance } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import bytes from "bytes";

import {
    deleteVehiclePhotoParams,
    DeleteVehiclePhotoParams,
    deleteVehiclePhotoResponse,
    postUploadVehiclePhotoParams,
    PostUploadVehiclePhotoParams,
    postUploadVehiclePhotoResponse,
} from "./vehiclePhoto.schema";
import { deleteVehiclePhoto, uploadVehiclePhoto } from "./vehiclePhoto.service";
import isFastifyError from "../../utils/isFastifyError.util";

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
                return reply.status(415).send({
                    message: "Request content type is not multipart",
                });
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
                    return reply.status(400).send({
                        message: "Only allowed field type is photo",
                    });
                }

                throw err;
            }

            if (!photo) {
                return reply.status(400).send({
                    message: "No vehicle photo uploaded",
                });
            }

            if (photo.fieldname !== "photo") {
                return reply.status(422).send({
                    message:
                        "Vehicle photo should be attached to the 'photo' field",
                });
            }

            const vehiclePhoto = await uploadVehiclePhoto(
                request.params.uuid,
                request.session.rental.uuid,
                photo,
            );
            return reply.status(201).send(vehiclePhoto);
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
