import { test, describe, expect, beforeAll, afterAll } from "@jest/globals";

import createFastifyServer from "../../loaders/fastify";

describe("GET /api/v1/unit-types", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    beforeAll(async () => {
        app = await createFastifyServer();
    });

    test("should get a list of unit types", async () => {
        const unitTypes = await app.prisma.unitType.findMany();
        const unitTypesWithoutId = unitTypes.map(({ name, uuid }) => ({
            name,
            uuid,
        }));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/unit-types",
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(unitTypesWithoutId);
    });

    afterAll(async () => {
        await app.close();
    });
});
