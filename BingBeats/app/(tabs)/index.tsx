import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { COUNTRIES, type CountryOption } from "../lib/countries";

const MIN_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

export default function HomeScreen() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const canDiscover = useMemo(() => {
    return Boolean(selectedCountry && selectedYear);
  }, [selectedCountry, selectedYear]);

  function handleCountryPress(country: CountryOption) {
    setSelectedCountry(country);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Ignore haptic failures on unsupported devices.
    });
  }

  function handleDiscover() {
    if (!selectedCountry || !selectedYear) {
      return;
    }

    router.push({
      pathname: "/playlist",
      params: {
        code: selectedCountry.code,
        name: selectedCountry.name,
        year: String(selectedYear)
      }
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BingBeats</Text>
      <Text style={styles.subtitle}>Discover music across time and space</Text>

      <FlatList
        contentContainerStyle={styles.countryListContent}
        data={COUNTRIES}
        keyExtractor={(item) => item.code}
        numColumns={3}
        renderItem={({ item }) => {
          const isSelected = selectedCountry?.code === item.code;
          return (
            <Pressable
              onPress={() => handleCountryPress(item)}
              style={[styles.countryCard, isSelected && styles.countryCardSelected]}
            >
              <Text style={styles.countryFlag}>{item.flag}</Text>
              <Text style={styles.countryName} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={styles.countryList}
      />

      <Text style={styles.yearText}>{selectedYear ?? CURRENT_YEAR}</Text>
      <Slider
        minimumValue={MIN_YEAR}
        maximumValue={CURRENT_YEAR}
        minimumTrackTintColor="#1DB954"
        maximumTrackTintColor="#2e2e2e"
        onValueChange={(value) => setSelectedYear(Math.round(value))}
        step={1}
        style={styles.slider}
        thumbTintColor="#1DB954"
        value={selectedYear ?? CURRENT_YEAR}
      />
      <Text style={styles.yearRangeLabel}>
        {MIN_YEAR} - {CURRENT_YEAR}
      </Text>

      <Pressable
        disabled={!canDiscover}
        onPress={handleDiscover}
        style={[styles.discoverButton, !canDiscover && styles.discoverButtonDisabled]}
      >
        <Text style={styles.discoverButtonText}>Discover</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    paddingHorizontal: 16,
    paddingTop: 72,
    paddingBottom: 24
  },
  title: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "800"
  },
  subtitle: {
    color: "#a0a0a0",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 20
  },
  countryList: {
    flexGrow: 0,
    maxHeight: 330
  },
  countryListContent: {
    paddingBottom: 8
  },
  countryCard: {
    flex: 1,
    margin: 6,
    minHeight: 88,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  countryCardSelected: {
    borderColor: "#1DB954",
    shadowColor: "#1DB954",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6
  },
  countryFlag: {
    fontSize: 30,
    marginBottom: 6
  },
  countryName: {
    color: "#ffffff",
    fontSize: 12,
    textAlign: "center"
  },
  yearText: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18
  },
  slider: {
    marginTop: 6
  },
  yearRangeLabel: {
    color: "#a0a0a0",
    textAlign: "center",
    marginTop: 6
  },
  discoverButton: {
    backgroundColor: "#1DB954",
    borderRadius: 12,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto"
  },
  discoverButtonDisabled: {
    backgroundColor: "#155f30"
  },
  discoverButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  }
});
