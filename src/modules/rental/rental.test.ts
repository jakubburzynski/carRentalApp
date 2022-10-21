import {
    test,
    describe,
    expect,
    beforeAll,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { UnitType } from "@prisma/client";

import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";

describe("POST /api/v1/rentals", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let unitTypes: UnitType[];
    beforeAll(async () => {
        app = await createFastifyServer();
        await app.prisma.rental.deleteMany();
        unitTypes = await app.prisma.unitType.findMany();
        if (unitTypes.length < 2) {
            throw new Error("Not enough unit types in the database");
        }
    });
    afterEach(async () => {
        await app.prisma.rental.deleteMany();
    });

    afterAll(async () => {
        await app.close();
    });

    test("should create a rental", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeUuid: unitTypes[0].uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
        });
        expect(rentals).toHaveLength(1);
        expect(rentals[0].unitTypeId).toEqual(unitTypes[0].id);
    });

    test("should not create more than one rental", async () => {
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

        const rentals = await app.prisma.rental.findMany();
        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: firstPayload.name,
        });
        expect(rentals).toHaveLength(1);
        expect(rentals[0].unitTypeId).toEqual(unitTypes[0].id);
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

        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid unit type uuid");
        expect(rentals).toHaveLength(0);
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
        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body must have required property 'name'",
        );
        expect(rentals).toHaveLength(0);
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
        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body/name must NOT have fewer than 3 characters",
        );
        expect(rentals).toHaveLength(0);
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
        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            "body must have required property 'unitTypeUuid'",
        );
        expect(rentals).toHaveLength(0);
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
        const rentals = await app.prisma.rental.findMany();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual(
            'body/unitTypeUuid must match format "uuid"',
        );
        expect(rentals).toHaveLength(0);
    });
});
