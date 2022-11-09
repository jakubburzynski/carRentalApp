import { FastifyReply, FastifyRequest } from "fastify";

export function isLoggedIn(
    request: FastifyRequest,
    reply: FastifyReply,
    done: (error?: Error) => void,
) {
    if (request.session.authenticated !== true) {
        done(new Error("Not authenticated"));
    }
    done();
}
