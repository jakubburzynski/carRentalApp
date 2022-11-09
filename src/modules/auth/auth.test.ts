import {
    test,
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Rental, RentalManager } from "@prisma/client";
import sinon, { SinonSpiedMember } from "sinon";
import argon2 from "argon2";
import { MemoryStore } from "@fastify/session";

import createFastifyServer from "../../loaders/fastify";
import * as rentalManagerService from "../rentalManager/rentalManager.service";

describe("POST /api/v1/auth/sessions", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let memoryStoreSetSpy: SinonSpiedMember<MemoryStore["set"]>;
    let findRentalManagerByLoginCredentialsSpy: SinonSpiedMember<
        typeof rentalManagerService["findRentalManagerByLoginCredentials"]
    >;

    const examplePassword = "Q2Fz Zj{d";

    beforeEach(async () => {
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
            },
        });
    });

    beforeAll(async () => {
        app = await createFastifyServer();
        memoryStoreSetSpy = sinon.spy(MemoryStore.prototype, "set");
        findRentalManagerByLoginCredentialsSpy = sinon.spy(
            rentalManagerService,
            "findRentalManagerByLoginCredentials",
        );
        await app.prisma.rental.deleteMany();
        await app.prisma.rentalManager.deleteMany();
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
    });

    afterEach(async () => {
        await app.prisma.rentalManager.deleteMany();
        memoryStoreSetSpy.resetHistory();
        findRentalManagerByLoginCredentialsSpy.resetHistory();
    });

    afterAll(async () => {
        await app.prisma.rentalManager.deleteMany();
        memoryStoreSetSpy.restore();
        findRentalManagerByLoginCredentialsSpy.restore();
        await app.close();
    });

    test("should login rental manager", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(201);
        expect(response.body).toEqual("");
        // check if session was created
        expect(memoryStoreSetSpy.calledOnce).toBe(true);
        expect(memoryStoreSetSpy.lastCall.args[1]).toHaveProperty(
            "authenticated",
            true,
        );
        expect(memoryStoreSetSpy.lastCall.args[1]).toHaveProperty(
            "rentalManager",
            {
                uuid: rentalManager.uuid,
                name: rentalManager.name,
            },
        );
        expect(memoryStoreSetSpy.lastCall.args[1]).toHaveProperty("rental", {
            uuid: rental.uuid,
            name: rental.name,
        });
        // check if cookie is set
        expect(response.cookies).toHaveLength(1);
        expect((response.cookies[0] as { name: string }).name).toEqual(
            "sessionId",
        );
    });

    test("should not process already logged in rental manager", async () => {
        const firstResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });
        const secondResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: {
                sessionId: (
                    firstResponse.cookies[0] as { name: string; value: string }
                ).value,
            },
        });

        expect(secondResponse.statusCode).toBe(201);
        expect(secondResponse.body).toEqual("");
        // check if second request returned at authenticated check
        expect(findRentalManagerByLoginCredentialsSpy.calledOnce).toBe(true);
        // session is saved after every response
        expect(memoryStoreSetSpy.calledTwice).toBe(true);
        // check if cookie is set
        expect(secondResponse.cookies).toHaveLength(1);
        expect(
            (secondResponse.cookies[0] as { name: string; value: string }).name,
        ).toEqual("sessionId");
    });

    test("should not login rental manager with non-existing email", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: faker.internet.email(),
                password: examplePassword,
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Rental manager not found");
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });

    test("should not login rental manager with wrong password", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: faker.internet.password(),
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Rental manager not found");
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });

    test("should not login not activated rental manager", async () => {
        await app.prisma.rentalManager.update({
            where: {
                id: rentalManager.id,
            },
            data: {
                active: false,
            },
        });
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual(
            "Rental manager account not activated",
        );
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });

    test("should check if body email property is present", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                password: faker.internet.password(),
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'email'",
        );
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });

    test("should check if body email property is valid email", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: faker.random.word(),
                password: faker.internet.password(),
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/email must match format "email"',
        );
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });

    test("should check if body password property is present", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: faker.random.word(),
            },
            cookies: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body must have required property 'password'",
        );
        // check if session was not created
        expect(memoryStoreSetSpy.notCalled).toBe(true);
        // check if cookie has not been set
        expect(response.cookies).toHaveLength(0);
    });
});

describe("DELETE /api/v1/auth/sessions", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let memoryStoreDestroySpy: SinonSpiedMember<MemoryStore["destroy"]>;

    const examplePassword = "Q2Fz Zj{d";

    beforeEach(async () => {
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash(examplePassword),
                active: true,
                activationToken: null,
                activationTokenExpiration: null,
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
            },
        });
    });

    beforeAll(async () => {
        app = await createFastifyServer();
        memoryStoreDestroySpy = sinon.spy(MemoryStore.prototype, "destroy");
        await app.prisma.rental.deleteMany();
        await app.prisma.rentalManager.deleteMany();
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: {
                        id: unitType.id,
                    },
                },
            },
        });
    });

    afterEach(async () => {
        await app.prisma.rentalManager.deleteMany();
        memoryStoreDestroySpy.resetHistory();
    });

    afterAll(async () => {
        await app.prisma.rentalManager.deleteMany();
        memoryStoreDestroySpy.restore();
        await app.close();
    });

    test("should logout rental manager", async () => {
        const loginResponse = await app.inject({
            method: "POST",
            url: "/api/v1/auth/sessions",
            payload: {
                email: rentalManager.email,
                password: examplePassword,
            },
            cookies: undefined,
        });

        const logoutResponse = await app.inject({
            method: "DELETE",
            url: "/api/v1/auth/sessions",
            cookies: {
                sessionId: (
                    loginResponse.cookies[0] as { name: string; value: string }
                ).value,
            },
        });

        expect(logoutResponse.statusCode).toBe(204);
        expect(memoryStoreDestroySpy.calledOnce).toBe(true);
        expect(logoutResponse.cookies).toHaveLength(0);
    });

    test("should not logout not logged in rental manager", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/auth/sessions",
            cookies: undefined,
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().message).toEqual("Not authenticated");
        expect(memoryStoreDestroySpy.notCalled).toBe(true);
        expect(response.cookies).toHaveLength(0);
    });
});
