import { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

function isLoggedIn(
    request: FastifyRequest,
    reply: FastifyReply,
    done: (error?: Error) => void,
) {
    if (request.session.authenticated !== true) {
        done(new Error("Not authenticated"));
    }
    done();
}

const authMiddlewarePlugin: FastifyPluginCallback = (server, options, done) => {
    server.decorate("isLoggedIn", isLoggedIn);

    done();
};

export default fp(authMiddlewarePlugin);
