const { teardown: teardownDevServer } = require('jest-dev-server');

module.exports = async function globalTeardown() {
    if (global.__JEST_DEV_SERVER_PROCS__) {
        await teardownDevServer(global.__JEST_DEV_SERVER_PROCS__);
    }
};
