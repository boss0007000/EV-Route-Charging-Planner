const React = require('react');
const {View} = require('react-native');

const MockMapView = ({children, ...props}) =>
  React.createElement(View, props, children);
MockMapView.Animated = MockMapView;

const MockMarker = ({children, ...props}) =>
  React.createElement(View, props, children);
const MockPolyline = props => React.createElement(View, props);
const MockCallout = ({children, ...props}) =>
  React.createElement(View, props, children);

module.exports = MockMapView;
module.exports.Marker = MockMarker;
module.exports.Polyline = MockPolyline;
module.exports.Callout = MockCallout;
module.exports.PROVIDER_GOOGLE = 'google';
