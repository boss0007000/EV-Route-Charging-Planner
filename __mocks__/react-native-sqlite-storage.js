const mockDb = {
  executeSql: jest.fn((sql, params, success) => {
    success && success(mockDb, {rows: {length: 0, item: jest.fn()}});
  }),
  transaction: jest.fn(callback => {
    callback(mockDb);
  }),
};

const SQLite = {
  openDatabase: jest.fn((name, version, displayName, size, success) => {
    success && success(mockDb);
    return mockDb;
  }),
  enablePromise: jest.fn(),
};

module.exports = SQLite;
