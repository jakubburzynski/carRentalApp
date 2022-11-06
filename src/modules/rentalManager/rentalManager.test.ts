import {
    test,
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterAll,
    afterEach,
    jest,
} from "@jest/globals";
import { faker } from "@faker-js/faker";
import { Rental, RentalManager } from "@prisma/client";
import sinon, { SinonStubbedMember, SinonSpiedMember } from "sinon";
import argon2 from "argon2";

import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";
import passwordRegex from "../../utils/passwordRegex.util";
import mailingService from "../../loaders/mail";
import * as randomToken from "../../utils/randomToken.util";

describe("POST /api/v1/rental-managers", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let argon2HashSpy: SinonSpiedMember<typeof argon2.hash>;
    let randomTokenSpy: SinonSpiedMember<typeof randomToken.default>;
    let mailSendStub: SinonStubbedMember<typeof mailingService.send>;

    const examplePassword = "Q2Fz Zj{d";
    const fakeDate = new Date("2022-01-02T01:02:03Z");

    beforeEach(() => {
        jest.useFakeTimers({
            advanceTimers: true,
        }).setSystemTime(fakeDate);
    });

    beforeAll(async () => {
        argon2HashSpy = sinon.spy(argon2, "hash");
        randomTokenSpy = sinon.spy(randomToken, "default");
        mailSendStub = sinon.stub(mailingService, "send").resolves();
        app = await createFastifyServer();
        await app.prisma.rental.deleteMany();
        await app.prisma.rentalManager.deleteMany();
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitTypeId: unitType.id,
            },
        });
    });

    afterEach(async () => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        await app.prisma.rentalManager.deleteMany();
        argon2HashSpy.resetHistory();
        randomTokenSpy.resetHistory();
        mailSendStub.resetHistory();
    });

    afterAll(async () => {
        await app.prisma.rentalManager.deleteMany();
        argon2HashSpy.restore();
        randomTokenSpy.restore();
        mailSendStub.restore();
        await app.close();
    });

    test("make sure example password matches regex", () => {
        expect(examplePassword).toMatch(passwordRegex);
    });

    test("should create a rental manager", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: payload.name,
            email: payload.email,
        });
        expect(argon2HashSpy.calledOnceWithExactly(payload.password)).toBe(
            true,
        );
        expect(rentalManagers[0].password).toEqual(
            await argon2HashSpy.returnValues[0],
        );
        expect(
            mailSendStub.calledOnceWithExactly({
                to: payload.email,
                subject: "Rental manager account verifictation",
                text: `Hi, ${payload.name}! Activation token: ${randomTokenSpy.returnValues[0]}, expires in 24 hours.`,
                html: `Hi, ${payload.name}! Activation token: ${randomTokenSpy.returnValues[0]}, expires in 24 hours.`,
            }),
        ).toBe(true);
        expect(rentalManagers.length).toBe(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(randomTokenSpy.calledOnceWithExactly(32)).toBe(true);
        expect(rentalManagers[0].activationToken).toEqual(
            randomTokenSpy.returnValues[0],
        );
        expect(rentalManagers[0].activationTokenExpiration.toString()).toBe(
            new Date(fakeDate.getTime() + 1000 * 60 * 60 * 24).toString(),
        );
    });

    test("should not create a rental manager with not existing rental uuid", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: faker.datatype.uuid(),
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid rental uuid");
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should not create more than one rental manager", async () => {
        const firstPayload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const firstResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload: firstPayload,
        });

        const secondPayload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const secondResponse = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload: secondPayload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(firstResponse.statusCode).toBe(201);
        expect(firstResponse.json()).toEqual({
            uuid: expect.stringMatching(uuidRegex),
            name: firstPayload.name,
            email: firstPayload.email,
        });
        expect(argon2HashSpy.calledOnceWithExactly(firstPayload.password)).toBe(
            true,
        );
        expect(rentalManagers.length).toBe(1);
        expect(rentalManagers[0].password).toEqual(
            await argon2HashSpy.returnValues[0],
        );
        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.json().message).toEqual(
            "It is not possible to register more than one rental manager",
        );
    });

    test("should check if name is at least 3 characters long", async () => {
        const payload = {
            name: "ab",
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "body/name must NOT have fewer than 3 characters",
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check for invalid email", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: "invalidemail@",
            password: examplePassword,
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/email must match format "email"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password is at least 8 characters", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa1!Aa1",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one small letter", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "AA1!AA1!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one capital letter", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "aa1!aa1!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one number", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa!!Aa!!",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password has at least one special character", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: "Aa11Aa11",
            rentalUuid: rental.uuid,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/password must match pattern "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[ !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~])[A-Za-z\\d !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~&]{8,}$"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if rentalUuid is a valid uuid", async () => {
        const payload = {
            name: faker.name.firstName(),
            email: faker.internet.email(),
            password: examplePassword,
            rentalUuid: 123,
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/rental-managers",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'body/rentalUuid must match format "uuid"',
        );
        expect(argon2HashSpy.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });
});

describe("PUT /api/v1/rental-managers/:uuid/active?token", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let mailSendStub: SinonStubbedMember<typeof mailingService.send>;

    const fakeDate = new Date("2022-01-02T01:02:03Z");
    const payload = { active: true };

    beforeEach(() => {
        jest.useFakeTimers({
            advanceTimers: true,
        }).setSystemTime(fakeDate);
    });

    beforeAll(async () => {
        mailSendStub = sinon.stub(mailingService, "send").resolves();
        app = await createFastifyServer();
        await app.prisma.rental.deleteMany();
        await app.prisma.rentalManager.deleteMany();
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitTypeId: unitType.id,
            },
        });
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash("Q2Fz Zj{d"),
                activationToken:
                    "3a45e0f76ceec72888aa48ebde478a05699a3f2476f3ab75abf45ea46ab74e74",
                activationTokenExpiration: new Date(
                    fakeDate.getTime() + 1000 * 60 * 60 * 24,
                ),
                rentalId: rental.id,
            },
        });
    });

    afterEach(async () => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        mailSendStub.resetHistory();
    });

    afterAll(async () => {
        await app.prisma.rentalManager.deleteMany();
        mailSendStub.restore();
        await app.close();
    });

    test("should activate rental manager", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=${rentalManager.activationToken}`,
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(204);
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(true);
        expect(rentalManagers[0].activationToken).toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).toBeNull();
        expect(mailSendStub).toHaveBeenNthCalledWith(1, {
            to: rentalManager.email,
            subject: "Rental manager account activated",
            text: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
            html: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
        });
    });

    test("should not activate rental manager with non existing uuid", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${faker.datatype.uuid()}/active?token=${
                rentalManager.activationToken
            }`,
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toEqual("Rental manager not found");
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(rentalManagers[0].activationToken).not.toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).not.toBeNull();
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should not activate rental manager with non existing token", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=3a45e0f76ceec72888aa48ebde478a05699a3f2476f3ab75abf45ea46ab74b31`,
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Invalid activation token");
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(rentalManagers[0].activationToken).not.toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).not.toBeNull();
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should not activate rental manager after token expiration", async () => {
        jest.setSystemTime(fakeDate.getTime() + 1000 * 60 * 60 * 24 * 5);
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=${rentalManager.activationToken}`,
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(response.statusCode).toBe(409);
        expect(response.json().message).toEqual("Activation token expired");
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(rentalManagers[0].activationToken).not.toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).not.toBeNull();
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should check if uuid param is a valid uuid", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/123/active?token=3a45e0f76ceec72888aa48ebde478a05699a3f2476f3ab75abf45ea46ab74e74",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/uuid must match format "uuid"',
        );
    });

    test("should check if token query string is a valid uuid", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active?token=12345",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("?");
    });

    test("should check if token query string is present", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("?");
    });

    test("should check if body active property is present", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active",
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("?");
    });

    test("should check if body active property is true", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active",
            payload: {
                active: false,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("?");
    });
});
