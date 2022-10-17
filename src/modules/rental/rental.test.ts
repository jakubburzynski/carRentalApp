import { test, describe, expect, beforeAll, afterAll } from "@jest/globals";
import { faker } from "@faker-js/faker";

import createFastifyServer from "../../loaders/fastify";

describe("POST /api/v1/rental", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    beforeAll(async () => {
        app = await createFastifyServer();
    });

    test("should create a rental", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeId: 0,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental",
            payload,
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toBe({
            uuid: expect.any(String),
            name: payload.name,
        });
    });

    test("should not create more than one rental", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeId: 0,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental",
            payload,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual(
            "It is not possible to create more than one rental",
        );
    });

    test("should check for invalid unit type id", async () => {
        const payload = {
            name: faker.company.name(),
            unitTypeId: 1867,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental",
            payload,
        });

        expect(response.statusCode).toBe(422);
        expect(response.json().message).toEqual("Invalid unit type id");
    });

    test("should check for missing name", async () => {
        const payload = {
            unitTypeId: 0,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(422);
        expect(responseJson.message).toEqual("Validation error");
        expect(responseJson.errors).toHaveProperty("name");
        expect(responseJson.errors.name).toContain("name is required");
    });

    test("should check for missing unitTypeId", async () => {
        const payload = {
            name: faker.company.name(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental",
            payload,
        });

        const responseJson = response.json();
        expect(response.statusCode).toBe(422);
        expect(responseJson.message).toEqual("Validation error");
        expect(responseJson.errors).toHaveProperty("unitTypeId");
        expect(responseJson.errors.name).toContain("unitTypeId is required");
    });

    afterAll(async () => {
        await app.close();
    });
});
