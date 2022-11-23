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

import cleanupDatabase from "../../../test/utils/cleanupDatabase";
import createFastifyServer from "../../loaders/fastify";
import uuidRegex from "../../utils/uuidRegex.util";
import passwordRegex from "../../utils/passwordRegex.util";
import { MailingService } from "../../loaders/mail";
import * as randomToken from "../../utils/randomToken.util";

describe("POST /api/v1/rental-managers", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let argon2HashSpy: SinonSpiedMember<typeof argon2.hash>;
    let randomTokenSpy: SinonSpiedMember<typeof randomToken.default>;
    let mailSendStub: SinonStubbedMember<typeof MailingService.prototype.send>;

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
        mailSendStub = sinon.stub(MailingService.prototype, "send").resolves();
        app = await createFastifyServer();
        await cleanupDatabase(app.prisma);
        const unitType = await app.prisma.unitType.findFirstOrThrow();
        rental = await app.prisma.rental.create({
            data: {
                name: faker.company.name(),
                unitType: {
                    connect: { id: unitType.id },
                },
            },
        });
    });

    afterEach(async () => {
        jest.useRealTimers();
        await app.prisma.rentalManager.deleteMany();
        argon2HashSpy.resetHistory();
        randomTokenSpy.resetHistory();
        mailSendStub.resetHistory();
    });

    afterAll(async () => {
        await cleanupDatabase(app.prisma);
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
        expect(randomTokenSpy.calledOnceWithExactly(32)).toBe(true);
        expect(rentalManagers[0].activationToken).toEqual(
            await randomTokenSpy.returnValues[0],
        );
        expect(
            mailSendStub.calledOnceWithExactly({
                to: payload.email,
                subject: `[${rental.name}] Rental manager account verifictation`,
                text: `Hi, ${
                    payload.name
                }! Activation token: '${await randomTokenSpy
                    .returnValues[0]}', expires in 24 hours.`,
                html: `Hi, ${
                    payload.name
                }! Activation token: '${await randomTokenSpy
                    .returnValues[0]}', expires in 24 hours.`,
            }),
        ).toBe(true);
        expect(rentalManagers.length).toBe(1);
        expect(rentalManagers[0].active).toBe(false);
        expect(rentalManagers[0].activationToken).toHaveLength(32);
        expect(rentalManagers[0].activationTokenExpiration).not.toBeNull();
        expect(
            (rentalManagers[0].activationTokenExpiration as Date).toString(),
        ).toBe(new Date(fakeDate.getTime() + 1000 * 60 * 60 * 24).toString());
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(
            mailSendStub.calledOnceWithExactly({
                to: firstPayload.email,
                subject: `[${rental.name}] Rental manager account verifictation`,
                text: `Hi, ${
                    firstPayload.name
                }! Activation token: '${await randomTokenSpy
                    .returnValues[0]}', expires in 24 hours.`,
                html: `Hi, ${
                    firstPayload.name
                }! Activation token: '${await randomTokenSpy
                    .returnValues[0]}', expires in 24 hours.`,
            }),
        ).toBe(true);
        expect(randomTokenSpy.calledOnce).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });

    test("should check if password is at least 8 characters", async () => {
        const payload = {
            name: faker.name.fullName(),
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(randomTokenSpy.notCalled).toBe(true);
        expect(mailSendStub.notCalled).toBe(true);
        expect(await app.prisma.rentalManager.count()).toBe(0);
    });
});

describe("PUT /api/v1/rental-managers/:uuid/active?token", () => {
    let app: Awaited<ReturnType<typeof createFastifyServer>>;
    let rental: Rental;
    let rentalManager: RentalManager;
    let mailSendStub: SinonStubbedMember<typeof MailingService.prototype.send>;

    const fakeDate = new Date("2022-01-02T01:02:03Z");
    const payload = { active: true };

    beforeEach(async () => {
        jest.useFakeTimers({
            advanceTimers: true,
        }).setSystemTime(fakeDate);
        rentalManager = await app.prisma.rentalManager.create({
            data: {
                name: faker.name.firstName(),
                email: faker.internet.email(),
                password: await argon2.hash("Q2Fz Zj{d"),
                activationToken: await randomToken.default(32),
                activationTokenExpiration: new Date(
                    fakeDate.getTime() + 1000 * 60 * 60 * 24,
                ),
                rental: {
                    connect: {
                        id: rental.id,
                    },
                },
            },
        });
    });

    beforeAll(async () => {
        mailSendStub = sinon.stub(MailingService.prototype, "send").resolves();
        app = await createFastifyServer();
        await cleanupDatabase(app.prisma);
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
        jest.useRealTimers();
        mailSendStub.resetHistory();
    });

    afterAll(async () => {
        await cleanupDatabase(app.prisma);
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
        expect(response.body).toEqual("");
        expect(response.headers).toHaveProperty(
            "referrer-policy",
            "no-referrer",
        );
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(true);
        expect(rentalManagers[0].activationToken).toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).toBeNull();
        expect(
            mailSendStub.calledOnceWithExactly({
                to: rentalManager.email,
                subject: `[${rental.name}] Rental manager account activated`,
                text: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
                html: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
            }),
        ).toBe(true);
    });

    test("should check for already activated rental manager", async () => {
        await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=${rentalManager.activationToken}`,
            payload,
        });
        const secondResponse = await app.inject({
            method: "PUT",
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=${rentalManager.activationToken}`,
            payload,
        });

        const rentalManagers = await app.prisma.rentalManager.findMany();
        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.json().message).toEqual(
            "Rental manager already activated",
        );
        expect(rentalManagers).toHaveLength(1);
        expect(rentalManagers[0].active).toBe(true);
        expect(rentalManagers[0].activationToken).toBeNull();
        expect(rentalManagers[0].activationTokenExpiration).toBeNull();
        expect(
            mailSendStub.calledOnceWithExactly({
                to: rentalManager.email,
                subject: `[${rental.name}] Rental manager account activated`,
                text: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
                html: `Hi, ${rentalManager.name}! Your account has been activated. You can now log in to your account.`,
            }),
        ).toBe(true);
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
            url: `/api/v1/rental-managers/${rentalManager.uuid}/active?token=FUO3vpGMe4cWC2L1LN85oH8v56HND0Fy`,
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
            url: "/api/v1/rental-managers/123/active?token=FUO3vpGMe4cWC2L1LN85oH8v56HND0Fy",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            'params/uuid must match format "uuid"',
        );
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should check if token query string is a valid token", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active?token=12345",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "querystring/token must NOT have fewer than 32 characters",
        );
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should check if token query string is present", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active",
            payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual(
            "querystring must have required property 'token'",
        );
        expect(mailSendStub.notCalled).toBe(true);
    });

    test("should check if body active property is present", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/rental-managers/85955c64-78bf-492c-94e6-6cb2a0770bca/active?token=3a45e0f76ceec72888aa48ebde478a05699a3f2476f3ab75abf45ea46ab74e74",
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toEqual("body must be object");
        expect(mailSendStub.notCalled).toBe(true);
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
        expect(response.json().message).toEqual(
            "body/active must be equal to constant",
        );
        expect(mailSendStub.notCalled).toBe(true);
    });
});
