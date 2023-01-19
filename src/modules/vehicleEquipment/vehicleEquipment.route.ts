import { FastifyInstanceWithTypebox } from "../../loaders/fastify";
import {
    patchVehicleEquipmentSchema,
    postCreateVehicleEquipmentSchema,
    deleteVehicleEquipmentSchema,
} from "./vehicleEquipment.schema";
import {
    createVehicleEquipment,
    deleteVehicleEquipment,
    updateVehicleEquipmentName,
} from "./vehicleEquipment.service";

export default async function vehicleEquipmentRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.post(
        "/:uuid/equipment",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: postCreateVehicleEquipmentSchema,
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

    server.patch(
        "/:vehicleUuid/equipment/:equipmentUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: patchVehicleEquipmentSchema,
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

    server.delete(
        "/:vehicleUuid/equipment/:equipmentUuid",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: deleteVehicleEquipmentSchema,
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
