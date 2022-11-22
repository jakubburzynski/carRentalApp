import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { MultipartFile } from "@fastify/multipart";
import bytes from "bytes";

import {
    PostCreateVehicleBody,
    postCreateVehicleBody,
    postCreateVehicleResponse,
    postUploadVehiclePhotoParams,
    PostUploadVehiclePhotoParams,
    postUploadVehiclePhotoResponse,
} from "./vehicle.schema";
import { createVehicle } from "./vehicle.service";
import { uploadVehiclePhoto } from "../vehiclePhoto/vehiclePhoto.service";
import isFastifyError from "../../utils/isFastifyError.util";

export default async function vehicleRoutes(server: FastifyInstance) {
    server.post<{ Body: PostCreateVehicleBody }>(
        "/",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                body: postCreateVehicleBody,
                response: {
                    201: postCreateVehicleResponse,
                },
            },
        },
        async (request, reply) => {
            const vehicle = await createVehicle({
                brand: request.body.brand,
                model: request.body.model,
                year: request.body.year,
                description: request.body.description || null,
                mileage: request.body.mileage,
                licensePlate: request.body.licensePlate,
                pricePerDay: new Prisma.Decimal(request.body.pricePerDay),
                name: request.body.name || null,
                rentalUuid: request.body.rentalUuid,
                fuelTypeUuid: request.body.fuelTypeUuid,
            });
            return reply.status(201).send(vehicle);
        },
    );

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
                photo,
            );
            return reply.status(201).send(vehiclePhoto);
        },
    );
}
