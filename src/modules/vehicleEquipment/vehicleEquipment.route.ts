import { FastifyInstance } from "fastify";

import {
    DeleteVehicleEquipmentParams,
    deleteVehicleEquipmentParams,
    deleteVehicleEquipmentResponse,
    PatchVehicleEquipmentBody,
    patchVehicleEquipmentBody,
    PatchVehicleEquipmentParams,
    patchVehicleEquipmentParams,
    patchVehicleEquipmentResponse,
    postCreateVehicleEquipmentBody,
    PostCreateVehicleEquipmentBody,
    postCreateVehicleEquipmentParams,
    PostCreateVehicleEquipmentParams,
    postCreateVehicleEquipmentResponse,
} from "./vehicleEquipment.schema";
import {
    createVehicleEquipment,
    deleteVehicleEquipment,
    updateVehicleEquipmentName,
} from "./vehicleEquipment.service";

export default async function vehicleEquipmentRoutes(server: FastifyInstance) {
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
                rentalUuid: request.session.rental.uuid,
            });
            return reply.status(201).send(vehicleEquipment);
        },
    );

    server.patch<{
        Body: PatchVehicleEquipmentBody;
        Params: PatchVehicleEquipmentParams;
    }>(
        "/:vehicleUuid/equipment/:equipmentUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: {
                body: patchVehicleEquipmentBody,
                params: patchVehicleEquipmentParams,
                response: {
                    204: patchVehicleEquipmentResponse,
                },
            },
        },
        async (request, reply) => {
            await updateVehicleEquipmentName({
                name: request.body[0].value,
                equipmentUuid: request.params.equipmentUuid,
                vehicleUuid: request.params.vehicleUuid,
                rentalUuid: request.session.rental.uuid,
            });
            return reply.status(204).send();
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
