export default {
  roots: ["<rootDir>/src", "<rootDir>/tst"],
  testMatch: ["**/tst/**/*.test.+(ts|tsx|js)"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
};
