import { Prisma } from "@prisma/client";

import { postCreateVehicleSchema } from "./vehicle.schema";
import { createVehicle } from "./vehicle.service";
import { FastifyInstanceWithTypebox } from "../../loaders/fastify";

export default async function vehicleRoutes(
    server: FastifyInstanceWithTypebox,
) {
    server.post(
        "/",
        {
            preHandler: server.auth([server.isLoggedIn]),
            schema: postCreateVehicleSchema,
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
}
