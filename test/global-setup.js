const { setup: setupDevServer } = require('jest-dev-server');

module.exports = async function globalSetup() {
    global.__JEST_DEV_SERVER_PROCS__ = await setupDevServer({
        command: `http-server -p 8080 ./dist`,
        launchTimeout: 90000,
        port: 8080,
    });
};
