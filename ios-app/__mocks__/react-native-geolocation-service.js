const Geolocation = {
  getCurrentPosition: jest.fn((success, _error, _options) => {
    success({
      coords: {
        latitude: 51.5074,
        longitude: -0.1278,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
  }),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
};

module.exports = Geolocation;
