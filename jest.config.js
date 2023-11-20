module.exports = {
  preset: 'jest-puppeteer',
  roots: ['src'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: 'tsconfig.test.json'}],
  },
}
