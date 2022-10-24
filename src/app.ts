import createFastifyServer from "./loaders/fastify";

(async () => {
    const server = await createFastifyServer({
        logger: true,
    });

    server.listen(
        { port: server.config.SERVER_PORT, host: "0.0.0.0" },
        (err) => {
            if (err) {
                server.log.error(err);
                process.exit(1);
            }
        },
    );
})();
