import {
    test,
    describe,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";

import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";

describe("POST /api/v1/rentals", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    beforeAll(async () => {
        app = await createFastifyServer();
        await app.prisma.rental.deleteMany();
    });
    afterEach(async () => {
        await app.prisma.rental.deleteMany();
    });

    test("should create a rental", async () => {
        const unitType = await app.prisma.unitType.findFirst();
        if (!unitType) {
            throw new Error("No unit types found");
        }
        const payload = {
            name: faker.company.name(),
            unitTypeUuid: unitType.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
        });
    });

    test("should not create more than one rental", async () => {
        const unitTypes = await app.prisma.unitType.findMany();
        if (unitTypes.length < 2) {
            throw new Error("Not enough unit types found");
        }
        const firstPayload = {
            name: faker.company.name(),
            unitTypeUuid: unitTypes[0].uuid,
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload: firstPayload,
        });

        const secondPayload = {
            name: faker.company.name(),
            unitTypeUuid: unitTypes[1].uuid,
        };
        const secondResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload: secondPayload,
        });

        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: firstPayload.name,
        });
        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.json().message).toEqual(
            "It is not possible to create more than one rental",
        );
    });

    test("should not create rental with not existing unit type id", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid unit type uuid");
    });

    test("should check for missing name", async () => {
        const payload = {
            unitTypeUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body must have required property 'name'",
        );
    });

    test("should check for name shorter than 3 char", async () => {
        const payload = {
            name: "ab",
            unitTypeUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body/name must NOT have fewer than 3 characters",
        );
    });

    test("should check for missing unitTypeUuid", async () => {
        const payload = {
            name: faker.company.name(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body must have required property 'unitTypeUuid'",
        );
    });

    test("should check for type of unitTypeUuid other than uuid", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeUuid: 123,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            'body/unitTypeUuid must match format "uuid"',
        );
    });

    afterAll(async () => {
        await app.close();
    });
});
