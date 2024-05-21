const suite = process.env.TEST_SUITE || 'screenshots';

const suiteParams = {
    screenshots: {
        globalSetup: './test/global-setup.js',
        globalTeardown: './test/global-teardown.js',
        maxWorkers: 5,
        maxConcurrency: 3,
        testTimeout: 50000,
        testEnvironment: 'node',
        testMatch: ['**/test/screenshots/**/*.ts'],
    }
};

module.exports = {
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            diagnostics: {
                // Игнорируем воргинги про esModuleInterop, которые нам чинить, кажется не требуется
                // потому что в тестах импорты работают без проблем.
                ignoreCodes: [151001],
            },
        },
    },
    ...suiteParams[suite],
};
