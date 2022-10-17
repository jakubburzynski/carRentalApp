import createFastifyServer from "./loaders/fastify";

(async () => {
    const server = await createFastifyServer({
        logger: true,
    });

    server.listen(
        { port: server.config.PORT, host: server.config.HOST },
        (err) => {
            if (err) {
                server.log.error(err);
                process.exit(1);
            }
        },
    );
})();
