/**
 * LocationInput — text field with Google Places autocomplete
 * and a "use current location" button.
 */

import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {autocompletePlaces, reverseGeocode} from '../../services/googleMaps';
import {requestLocationPermission} from '../../utils/locationPermission';
import {PlaceResult, LatLng} from '../../types';
import {COLORS} from '../../constants/colors';

interface Props {
  label?: string;
  placeholder?: string;
  value: PlaceResult | null;
  onChange: (place: PlaceResult | null) => void;
  showCurrentLocation?: boolean;
  onCurrentLocationRequested?: (coord: LatLng, address: string) => void;
}

export default function LocationInput({
  label,
  placeholder = 'Enter location…',
  value,
  onChange,
  showCurrentLocation = false,
  onCurrentLocationRequested,
}: Props) {
  const [text, setText] = useState(value?.description ?? '');
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChangeText = useCallback(
    (input: string) => {
      setText(input);
      onChange(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (input.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await autocompletePlaces(input);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setSuggestions([]);
        }
      }, 300);
    },
    [onChange],
  );

  const handleSelectSuggestion = useCallback(
    (place: PlaceResult) => {
      setText(place.description);
      setSuggestions([]);
      setShowSuggestions(false);
      onChange(place);
    },
    [onChange],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setLoadingGps(true);
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setLoadingGps(false);
      Alert.alert(
        'Location Permission Needed',
        'Enable location access in Settings to use your current location.',
      );
      return;
    }
    Geolocation.getCurrentPosition(
      async position => {
        const coord: LatLng = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        try {
          const address = await reverseGeocode(coord);
          const place: PlaceResult = {
            placeId: '',
            description: address,
            mainText: address,
            secondaryText: '',
            coordinate: coord,
          };
          setText(address);
          onChange(place);
          onCurrentLocationRequested?.(coord, address);
        } catch {
          const fallback = `${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`;
          const place: PlaceResult = {
            placeId: '',
            description: fallback,
            mainText: fallback,
            secondaryText: '',
            coordinate: coord,
          };
          setText(fallback);
          onChange(place);
        } finally {
          setLoadingGps(false);
        }
      },
      _error => {
        setLoadingGps(false);
        Alert.alert('Location Unavailable', 'Could not determine your current location.');
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  }, [onChange, onCurrentLocationRequested]);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <Text style={styles.icon}>📍</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={text}
          onChangeText={handleChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {showCurrentLocation && (
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            style={styles.gpsBtn}
            accessibilityLabel="Use current location">
            {loadingGps ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.gpsIcon}>🎯</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.placeId}
            scrollEnabled={false}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => handleSelectSuggestion(item)}>
                <Text style={styles.suggestionMain}>{item.mainText}</Text>
                {item.secondaryText ? (
                  <Text style={styles.suggestionSub}>{item.secondaryText}</Text>
                ) : null}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => (
              <View style={styles.suggestSeparator} />
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 14,
  },
  gpsBtn: {
    padding: 8,
    marginLeft: 4,
  },
  gpsIcon: {
    fontSize: 18,
  },
  dropdown: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 100,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionMain: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  suggestionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  suggestSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});
