/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', isolatedModules: true } }],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
}

module.exports = config
