// Adds the Firebase file to the Android build once you have downloaded it (see README, "Phone push").
// Without the file the app still builds; it just cannot receive push notifications on Android.
//
// APP_MODE=admin builds the separate admin site: it uses the admin-app/ screens only, so none of
// the admin code is in the public app and none of the public screens are in the admin site.
const fs = require('fs');

const admin = process.env.APP_MODE === 'admin';

module.exports = ({ config }) => ({
  ...config,
  ...(admin ? { name: 'Hithozha admin', slug: 'hithozha-admin', experiments: { typedRoutes: false } } : {}),
  plugins: (config.plugins ?? []).map((plugin) => (admin && plugin === 'expo-router' ? ['expo-router', { root: 'admin-app' }] : plugin)),
  android: {
    ...config.android,
    ...(fs.existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
  },
});
