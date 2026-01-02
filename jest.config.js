export default {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["**/tests/unit/**/*.test.js"],
      clearMocks: true,
      setupFiles: ["<rootDir>/tests/setup/env.js"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["**/tests/integration/**/*.test.js"],
      clearMocks: true,
      setupFiles: ["<rootDir>/tests/setup/env.js"],
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.js"],
      maxWorkers: 1,
    },
  ],
}
