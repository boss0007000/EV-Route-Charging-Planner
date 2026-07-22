module.exports = {
  default: jest.fn(props => {
    const React = require('react');
    const {View} = require('react-native');
    return React.createElement(View, props);
  }),
};
