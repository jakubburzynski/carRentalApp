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
        const payload = {
            name: faker.company.name(),
            unitTypeId: 1,
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
        const firstPayload = {
            name: faker.company.name(),
            unitTypeId: 1,
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload: firstPayload,
        });

        const secondPayload = {
            name: faker.company.name(),
            unitTypeId: 2,
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
            unitTypeId: 1867,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid unit type id");
    });

    test("should check for missing name", async () => {
        const payload = {
            unitTypeId: 1,
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
            unitTypeId: 1,
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

    test("should check for missing unitTypeId", async () => {
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
            "body must have required property 'unitTypeId'",
        );
    });

    test("should check for type of unitTypeId other than number", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeId: "metric",
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rentals",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(400);
        expect(responseJson.message).toEqual("body/unitTypeId must be number");
    });

    afterAll(async () => {
        await app.close();
    });
});
