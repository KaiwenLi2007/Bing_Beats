import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { getPublicConfig } from "../lib/api";
import { COUNTRIES } from "../lib/countries";
import { colors } from "../lib/theme";

/** Default height when parent does not pass `height` (avoids 0px WebView layout). */
export const GLOBE_WEBVIEW_HEIGHT = 300;

/** Spotify-style ISO 3166-1 alpha-2 codes we support in the app (same list as the flag grid). */
const SUPPORTED_ISO_CODES = new Set(COUNTRIES.map((c) => c.code));

export interface GlobeProps {
  onCountrySelect: (isoCode: string, countryName: string) => void;
  selectedCountryCode: string | null;
  /** Optional height (e.g. ~55% of screen on home). Defaults to {@link GLOBE_WEBVIEW_HEIGHT}. */
  height?: number;
  /** Highlight / invisible-fill color in Mapbox (syncs with app cycling accent). */
  accentColor?: string;
}

/**
 * Inline HTML for Mapbox GL JS v3 globe. Mapbox scripts/styles load from their CDN;
 * the access token is injected as a JSON-escaped string (safe for special chars).
 *
 * Click detection flow (for oral exam):
 * 1. We add vector source `mapbox://mapbox.country-boundaries-v1` with layer `country_boundaries`.
 * 2. `country-fills` is a full-country **fill** layer with fill-opacity 0 — it is invisible but
 *    still receives hits anywhere over land, unlike label-only layers (tiny hit targets).
 * 3. We stack `country-fills` **above** `country-highlight` so taps hit the invisible polygons;
 *    lines (`country-borders`) sit on top for visuals but rarely block land clicks.
 * 4. `map.on('click', 'country-fills', ...)` runs only when the user taps inside that layer’s
 *    geometry; we read ISO + name from feature properties and postMessage to React Native.
 * 5. `country-highlight` uses a filter on the same source so the selected country shows in green.
 *    Tileset uses `iso_3166_1_alpha_2` for 2-letter codes (Spotify markets); we also fall back
 *    to `iso_3166_1` if present. Worldview filter avoids duplicate disputed polygons.
 */
function buildGlobeHtml(mapboxAccessToken: string): string {
  const tokenJs = JSON.stringify(mapboxAccessToken);
  const defaultAccent = "#1DB954";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css" rel="stylesheet" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0a0a0a; overflow: hidden; }
    #map { width: 100%; height: 100%; min-height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js"></script>
  <script>
    (function () {
      try {
      if (typeof mapboxgl === "undefined") {
        throw new Error("mapbox-gl.js did not load (check network / CDN).");
      }
      mapboxgl.accessToken = ${tokenJs};

      var map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [0, 16],
        zoom: 0.9,
        minZoom: 0.4,
        maxZoom: 8,
        attributionControl: true
      });

      // Exposed for React Native injectJavaScript (highlight updates) and resize helper.
      window.map = map;
      window.__bingbeatsMap = map;

      window.__globeReady = false;
      window.__pendingSelected = null;

      /** Mapbox tileset uses iso_3166_1_alpha_2 for 2-letter codes; some rows expose iso_3166_1. */
      function getIsoA2(props) {
        if (!props) return "";
        var a2 = props.iso_3166_1_alpha_2 || props.iso_3166_1 || "";
        return String(a2).trim().toUpperCase().slice(0, 2);
      }

      function getCountryName(props) {
        if (!props) return "Unknown";
        return String(props.name_en || props.name || props.NAME || "").trim() || "Unknown";
      }

      function updateCountryHighlight(isoCode) {
        if (!map.getLayer("country-highlight")) return;
        if (!isoCode) {
          map.setFilter("country-highlight", ["literal", false]);
          return;
        }
        var code = String(isoCode).toUpperCase();
        map.setFilter("country-highlight", [
          "all",
          ["==", ["get", "iso_3166_1_alpha_2"], code],
          ["match", ["get", "worldview"], ["all", "US"], true, false]
        ]);
      }

      window.__bingbeatsSetSelected = function (code) {
        if (!window.__globeReady) {
          window.__pendingSelected = code || null;
          return;
        }
        updateCountryHighlight(code ? String(code).toUpperCase() : null);
      };

      map.on("load", function () {
        try {
          map.setFog({});
        } catch (e) {}

        try {
          if (!map.getSource("country-boundaries")) {
            map.addSource("country-boundaries", {
              type: "vector",
              url: "mapbox://mapbox.country-boundaries-v1"
            });
          }

          var worldviewFilter = ["match", ["get", "worldview"], ["all", "US"], true, false];

          // Selected country only (starts hidden — no country matches empty filter).
          if (!map.getLayer("country-highlight")) {
            map.addLayer({
              id: "country-highlight",
              type: "fill",
              source: "country-boundaries",
              "source-layer": "country_boundaries",
              paint: {
                "fill-color": "${defaultAccent}",
                "fill-opacity": 0.4
              },
              filter: ["literal", false]
            });
          }

          // Invisible fills: full country polygons = reliable hit targets (see file comment).
          if (!map.getLayer("country-fills")) {
            map.addLayer({
              id: "country-fills",
              type: "fill",
              source: "country-boundaries",
              "source-layer": "country_boundaries",
              paint: {
                "fill-color": "${defaultAccent}",
                "fill-opacity": 0
              },
              filter: worldviewFilter
            });
          }

          if (!map.getLayer("country-borders")) {
            map.addLayer({
              id: "country-borders",
              type: "line",
              source: "country-boundaries",
              "source-layer": "country_boundaries",
              paint: {
                "line-color": "#ffffff",
                "line-width": 0.3,
                "line-opacity": 0.2
              },
              filter: worldviewFilter
            });
          }

          // Click on the invisible fill layer — not labels — so taps work across whole country.
          map.on("click", "country-fills", function (e) {
            if (!e.features || e.features.length === 0) return;
            var feature = e.features[0];
            var props = feature.properties || {};
            var isoCode = getIsoA2(props);
            var countryName = getCountryName(props);
            if (!isoCode || isoCode.length !== 2) return;

            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(
                JSON.stringify({
                  type: "country_click",
                  iso_a2: isoCode,
                  name: countryName
                })
              );
            }
          });

          map.on("mouseenter", "country-fills", function () {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "country-fills", function () {
            map.getCanvas().style.cursor = "";
          });

          window.__setAccentColor = function (hex) {
            try {
              if (map.getLayer("country-highlight")) {
                map.setPaintProperty("country-highlight", "fill-color", hex);
              }
              if (map.getLayer("country-fills")) {
                map.setPaintProperty("country-fills", "fill-color", hex);
              }
            } catch (e) {}
          };
        } catch (layerErr) {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "globe_layer_error",
                message: String(layerErr && layerErr.message ? layerErr.message : layerErr)
              }));
            }
          } catch (e3) {}
        }

        window.__globeReady = true;
        if (window.__pendingSelected) {
          window.__bingbeatsSetSelected(window.__pendingSelected);
          window.__pendingSelected = null;
        }
      });

      window.addEventListener("resize", function () {
        try { map.resize(); } catch (e) {}
      });

      map.on("error", function (e) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "globe_map_error",
              message: (e && e.error && e.error.message) ? String(e.error.message) : "map error"
            }));
          }
        } catch (err) {}
      });
      } catch (bootErr) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "globe_boot_error",
              message: String(bootErr && bootErr.message ? bootErr.message : bootErr)
            }));
          }
        } catch (e2) {}
      }
    })();
  </script>
</body>
</html>`;
}

export const DEFAULT_MAP_ACCENT = "#1DB954";

export function Globe({
  onCountrySelect,
  selectedCountryCode,
  height,
  accentColor = DEFAULT_MAP_ACCENT
}: GlobeProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const html = useMemo(() => (mapboxToken ? buildGlobeHtml(mapboxToken) : ""), [mapboxToken]);
  const resolvedHeight = height ?? GLOBE_WEBVIEW_HEIGHT;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cfg = await getPublicConfig();
        const token = String(cfg.mapbox_public_token || "").trim();
        if (!token) {
          throw new Error("Mapbox token is missing on the API server.");
        }
        if (!cancelled) {
          setMapboxToken(token);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load map configuration.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const injectAccent = useCallback((hex: string) => {
    const safe = JSON.stringify(hex);
    webViewRef.current?.injectJavaScript(
      `try{if(window.__setAccentColor)window.__setAccentColor(${safe});}catch(e){}true;`
    );
  }, []);

  useEffect(() => {
    injectAccent(accentColor);
  }, [accentColor, injectAccent]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const raw = event.nativeEvent.data;
        const data = JSON.parse(raw) as {
          type?: string;
          iso_a2?: string;
          name?: string;
          message?: string;
        };
        if (data.type === "country_click" && data.iso_a2 && data.name) {
          const iso = data.iso_a2.toUpperCase();
          // Spotify catalog is market-based; we only enable countries in our curated COUNTRIES list.
          if (!SUPPORTED_ISO_CODES.has(iso)) {
            Alert.alert(
              "Not available",
              `Music data isn't available for ${data.name}. Try a different country!`
            );
            return;
          }
          onCountrySelect(iso, data.name);
          return;
        }
        if (
          __DEV__ &&
          (data.type === "globe_boot_error" ||
            data.type === "globe_map_error" ||
            data.type === "globe_layer_error")
        ) {
          console.warn("[Globe]", data.type, data.message);
        }
      } catch {
        // Ignore non-JSON or unrelated messages from the WebView.
      }
    },
    [onCountrySelect]
  );

  /**
   * When `selectedCountryCode` changes (e.g. user picked a country on the flag grid), push the
   * new ISO code into the WebView so `country-highlight` updates. The HTML exposes
   * `window.__bingbeatsSetSelected`, which mirrors `window.map.setFilter` on `country-highlight`.
   */
  useEffect(() => {
    const code = selectedCountryCode ?? "";
    const script = `
      (function () {
        if (typeof window.__bingbeatsSetSelected === "function") {
          window.__bingbeatsSetSelected(${JSON.stringify(code)});
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, [selectedCountryCode]);

  return (
    <View style={[styles.wrap, { height: resolvedHeight }]}>
      {!mapboxToken ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.text.primary} size="small" />
          <Text style={styles.loadingText}>
            {loadError ? "Map unavailable. Check Render MAPBOX_PUBLIC_TOKEN." : "Loading map..."}
          </Text>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: "https://www.mapbox.com/" }}
        style={[styles.webview, { height: resolvedHeight, opacity: mapboxToken ? 1 : 0 }]}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        /** WebGL (Mapbox) needs a hardware-backed surface on many Android devices. */
        androidLayerType={Platform.OS === "android" ? "hardware" : undefined}
        onLoadEnd={() => {
          webViewRef.current?.injectJavaScript(
            "try{if(window.__bingbeatsMap&&window.__bingbeatsMap.resize){window.__bingbeatsMap.resize();}}catch(e){};true;"
          );
          injectAccent(accentColor);
        }}
        onError={(e) => {
          if (__DEV__) {
            console.warn("[Globe] WebView error", e.nativeEvent.description);
          }
        }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.bg.primary
  },
  webview: {
    width: "100%",
    backgroundColor: colors.bg.primary
  },
  loadingState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.bg.primary,
    gap: 8,
    justifyContent: "center",
    zIndex: 2
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 12
  }
});
