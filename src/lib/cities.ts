export const CITY_KEYS = [
  'chennai',
  'coimbatore',
  'madurai',
  'tiruchirappalli',
  'salem',
  'tirunelveli',
  'erode',
  'vellore',
  'thoothukudi',
  'dharmapuri',
  'other',
] as const;

export type CityKey = (typeof CITY_KEYS)[number];
