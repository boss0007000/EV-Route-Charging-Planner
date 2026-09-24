const mockDb = {
  execute: jest.fn(async () => ({rows: [], rowsAffected: 0, insertId: 0})),
  transaction: jest.fn(async callback => {
    const tx = {
      execute: jest.fn(async () => ({rows: [], rowsAffected: 0, insertId: 0})),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    await callback(tx);
  }),
};

module.exports = {
  open: jest.fn(() => mockDb),
};
