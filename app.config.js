// Adds the Firebase file to the Android build once you have downloaded it (see README, "Phone push").
// Without the file the app still builds; it just cannot receive push notifications on Android.
const fs = require('fs');

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(fs.existsSync('./google-services.json') ? { googleServicesFile: './google-services.json' } : {}),
  },
});
