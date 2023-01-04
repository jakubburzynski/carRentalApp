import { test, describe, expect, beforeAll, afterAll } from "@jest/globals";

import createFastifyServer from "../../loaders/fastify";

describe("GET /api/v1/fuel-types", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    beforeAll(async () => {
        app = await createFastifyServer();
    });

    test("should get a list of all fuel types", async () => {
        const fuelTypes = await app.prisma.fuelType.findMany();
        const fuelTypesWithoutId = fuelTypes.map(({ uuid, name }) => ({
            name,
            uuid,
        }));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/fuel-types",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(fuelTypesWithoutId);
    });

    afterAll(async () => {
        await app.close();
    });
});
