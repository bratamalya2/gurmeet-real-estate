export const APPROXIMATE_CITY_COORDINATES = Object.freeze({
  'union city': { lat: 37.5934, lng: -122.0438 },
  hayward: { lat: 37.6688, lng: -122.0808 },
  fremont: { lat: 37.5483, lng: -121.9886 },
  tracy: { lat: 37.7397, lng: -121.4252 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  newark: { lat: 37.5297, lng: -122.0402 },
  dublin: { lat: 37.7022, lng: -121.9358 },
  manteca: { lat: 37.7974, lng: -121.2161 },
  lathrop: { lat: 37.8227, lng: -121.2766 },
  'mountain house': { lat: 37.7833, lng: -121.5427 },
  patterson: { lat: 37.4716, lng: -121.1297 },
  'san ramon': { lat: 37.7799, lng: -121.978 },
  sacramento: { lat: 38.5816, lng: -121.4944 },
  'santa clara': { lat: 37.3541, lng: -121.9552 },
  'castro valley': { lat: 37.6941, lng: -122.0864 },
  'rancho cordova': { lat: 38.5891, lng: -121.3027 },
  stockton: { lat: 37.9577, lng: -121.2908 },
  'san leandro': { lat: 37.7249, lng: -122.1561 },
  'san lorenzo': { lat: 37.681, lng: -122.1244 },
  livermore: { lat: 37.6819, lng: -121.768 },
  davis: { lat: 38.5449, lng: -121.7405 },
  'san mateo': { lat: 37.563, lng: -122.3255 },
  gilroy: { lat: 37.0058, lng: -121.5683 },
  oakley: { lat: 37.9974, lng: -121.7125 },
  pleasanton: { lat: 37.6624, lng: -121.8747 },
  'elk grove': { lat: 38.4088, lng: -121.3716 },
  ceres: { lat: 37.5949, lng: -120.9577 },
  vacaville: { lat: 38.3566, lng: -121.9877 },
  antioch: { lat: 38.0049, lng: -121.8058 },
  modesto: { lat: 37.6391, lng: -120.9969 },
  turlock: { lat: 37.4947, lng: -120.8466 },
  lincoln: { lat: 38.8916, lng: -121.293 },
  fairfield: { lat: 38.2494, lng: -122.04 },
});

const cityKey = value => String(value || '').trim().toLocaleLowerCase();

export function approximateCityCoordinate(city) {
  const coordinate = APPROXIMATE_CITY_COORDINATES[cityKey(city)];
  return coordinate ? { ...coordinate } : null;
}

export function buildApproximateCoordinateUpdates(properties = []) {
  const updates = [];
  let skippedExisting = 0;
  let skippedMissingCity = 0;
  let skippedUnsupportedCity = 0;

  for (const property of properties) {
    const lat = Number(property.coordinates?.lat);
    const lng = Number(property.coordinates?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      skippedExisting += 1;
      continue;
    }

    const city = String(property.address?.city || '').trim();
    if (!city) {
      skippedMissingCity += 1;
      continue;
    }

    const coordinate = approximateCityCoordinate(city);
    if (!coordinate) {
      skippedUnsupportedCity += 1;
      continue;
    }

    updates.push({ id: property._id, city, coordinates: coordinate });
  }

  return { updates, skippedExisting, skippedMissingCity, skippedUnsupportedCity };
}
