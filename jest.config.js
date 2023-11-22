module.exports = {
  roots: ['src'],
  testTimeout: 30000,
  transform: {
    '^.+\\.ts$': ['ts-jest', {tsconfig: 'tsconfig.test.json'}],
  },
}
