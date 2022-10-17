import { FastifyInstance } from "fastify";
import { postCreateRental } from "./rental.controller";
import {
    postCreateRentalBody,
    postCreateRentalResponse,
} from "./rental.schema";

export default async function rentalRoutes(server: FastifyInstance) {
    server.post(
        "/",
        {
            schema: {
                body: postCreateRentalBody,
                response: {
                    201: postCreateRentalResponse,
                },
            },
        },
        postCreateRental,
    );
}
