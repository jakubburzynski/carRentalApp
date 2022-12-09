import { FastifyInstance } from "fastify";

import {
    DeleteVehicleEquipmentParams,
    deleteVehicleEquipmentParams,
    deleteVehicleEquipmentResponse,
    postCreateVehicleEquipmentBody,
    PostCreateVehicleEquipmentBody,
    postCreateVehicleEquipmentParams,
    PostCreateVehicleEquipmentParams,
    postCreateVehicleEquipmentResponse,
} from "./vehicleEquipment.schema";
import {
    createVehicleEquipment,
    deleteVehicleEquipment,
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
