module.exports = {
  preset: 'jest-puppeteer',
  roots: ['src'],
  testTimeout: 10000,
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: 'tsconfig.test.json'}],
  },
}
