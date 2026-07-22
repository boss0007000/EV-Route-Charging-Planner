// Jest setup file — runs before each test suite

// Silence console.log in tests (allow warn/error)
global.console = {
  ...console,
  log: jest.fn(),
};

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
