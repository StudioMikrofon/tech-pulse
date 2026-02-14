import { GeoLocation } from "./types";

export const KNOWN_LOCATIONS: Record<string, GeoLocation> = {
  "san-francisco": { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194, countryCode: "US" },
  "new-york": { name: "New York, NY", lat: 40.7128, lon: -74.006, countryCode: "US" },
  "seattle": { name: "Seattle, WA", lat: 47.6062, lon: -122.3321, countryCode: "US" },
  "austin": { name: "Austin, TX", lat: 30.2672, lon: -97.7431, countryCode: "US" },
  "los-angeles": { name: "Los Angeles, CA", lat: 34.0522, lon: -118.2437, countryCode: "US" },
  "boston": { name: "Boston, MA", lat: 42.3601, lon: -71.0589, countryCode: "US" },
  "boca-chica": { name: "Boca Chica, TX", lat: 25.9975, lon: -97.1561, countryCode: "US" },
  "cape-canaveral": { name: "Cape Canaveral, FL", lat: 28.3922, lon: -80.6077, countryCode: "US" },
  "mountain-view": { name: "Mountain View, CA", lat: 37.3861, lon: -122.0839, countryCode: "US" },
  "redmond": { name: "Redmond, WA", lat: 47.674, lon: -122.1215, countryCode: "US" },
  "london": { name: "London, UK", lat: 51.5074, lon: -0.1278, countryCode: "GB" },
  "cambridge-uk": { name: "Cambridge, UK", lat: 52.2053, lon: 0.1218, countryCode: "GB" },
  "paris": { name: "Paris, France", lat: 48.8566, lon: 2.3522, countryCode: "FR" },
  "berlin": { name: "Berlin, Germany", lat: 52.52, lon: 13.405, countryCode: "DE" },
  "munich": { name: "Munich, Germany", lat: 48.1351, lon: 11.582, countryCode: "DE" },
  "zurich": { name: "Zurich, Switzerland", lat: 47.3769, lon: 8.5417, countryCode: "CH" },
  "stockholm": { name: "Stockholm, Sweden", lat: 59.3293, lon: 18.0686, countryCode: "SE" },
  "tokyo": { name: "Tokyo, Japan", lat: 35.6762, lon: 139.6503, countryCode: "JP" },
  "osaka": { name: "Osaka, Japan", lat: 34.6937, lon: 135.5023, countryCode: "JP" },
  "seoul": { name: "Seoul, South Korea", lat: 37.5665, lon: 126.978, countryCode: "KR" },
  "beijing": { name: "Beijing, China", lat: 39.9042, lon: 116.4074, countryCode: "CN" },
  "shanghai": { name: "Shanghai, China", lat: 31.2304, lon: 121.4737, countryCode: "CN" },
  "shenzhen": { name: "Shenzhen, China", lat: 22.5431, lon: 114.0579, countryCode: "CN" },
  "taipei": { name: "Taipei, Taiwan", lat: 25.033, lon: 121.5654, countryCode: "TW" },
  "bangalore": { name: "Bangalore, India", lat: 12.9716, lon: 77.5946, countryCode: "IN" },
  "tel-aviv": { name: "Tel Aviv, Israel", lat: 32.0853, lon: 34.7818, countryCode: "IL" },
  "singapore": { name: "Singapore", lat: 1.3521, lon: 103.8198, countryCode: "SG" },
  "sydney": { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093, countryCode: "AU" },
  "toronto": { name: "Toronto, Canada", lat: 43.6532, lon: -79.3832, countryCode: "CA" },
  "sao-paulo": { name: "Sao Paulo, Brazil", lat: -23.5505, lon: -46.6333, countryCode: "BR" },
  "kourou": { name: "Kourou, French Guiana", lat: 5.1597, lon: -52.6492, countryCode: "GF" },
  "geneva": { name: "Geneva, Switzerland", lat: 46.2044, lon: 6.1432, countryCode: "CH" },
};

export function resolveLocation(geo: { name: string; lat: number; lon: number; countryCode: string }): GeoLocation {
  // If lat/lon are provided directly, use them
  if (geo.lat !== undefined && geo.lon !== undefined) {
    return geo;
  }

  // Try to find in known locations
  const key = geo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const known = KNOWN_LOCATIONS[key];
  if (known) {
    return known;
  }

  // Default fallback
  return geo;
}
