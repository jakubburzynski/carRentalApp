import { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import {
    PostCreateVehicleBody,
    postCreateVehicleBody,
    postCreateVehicleResponse,
} from "./vehicle.schema";
import { createVehicle } from "./vehicle.service";

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
}
