import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { MultipartFile } from "@fastify/multipart";
import bytes from "bytes";

import {
    DeleteVehicleEquipmentParams,
    deleteVehicleEquipmentParams,
    deleteVehicleEquipmentResponse,
    PostCreateVehicleBody,
    postCreateVehicleBody,
    postCreateVehicleEquipmentBody,
    PostCreateVehicleEquipmentBody,
    postCreateVehicleEquipmentParams,
    PostCreateVehicleEquipmentParams,
    postCreateVehicleEquipmentResponse,
    postCreateVehicleResponse,
    postUploadVehiclePhotoParams,
    PostUploadVehiclePhotoParams,
    postUploadVehiclePhotoResponse,
} from "./vehicle.schema";
import { createVehicle } from "./vehicle.service";
import { uploadVehiclePhoto } from "../vehiclePhoto/vehiclePhoto.service";
import isFastifyError from "../../utils/isFastifyError.util";
import {
    createVehicleEquipment,
    deleteVehicleEquipment,
} from "../vehicleEquipment/vehicleEquipment.service";

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
                rentalUuid: request.session.rental.uuid,
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

    server.post<{
        Params: PostCreateVehicleEquipmentParams;
        Body: PostCreateVehicleEquipmentBody;
    }>(
        "/:uuid/equipment",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                params: postCreateVehicleEquipmentParams,
                body: postCreateVehicleEquipmentBody,
                response: {
                    201: postCreateVehicleEquipmentResponse,
                },
            },
        },
        async (request, reply) => {
            const vehicleEquipment = await createVehicleEquipment({
                name: request.body.name,
                vehicleUuid: request.params.uuid,
            });
            return reply.status(201).send(vehicleEquipment);
        },
    );

    server.delete<{ Params: DeleteVehicleEquipmentParams }>(
        "/:vehicleUuid/equipment/:equipmentUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                params: deleteVehicleEquipmentParams,
                response: {
                    204: deleteVehicleEquipmentResponse,
                },
            },
        },
        async (request, reply) => {
            await deleteVehicleEquipment({
                vehicleUuid: request.params.vehicleUuid,
                equipmentUuid: request.params.equipmentUuid,
                rentalUuid: request.session.rental.uuid,
            });
            return reply.status(204).send();
        },
    );
}
