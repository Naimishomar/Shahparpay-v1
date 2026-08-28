const { withGradleProperties } = require('@expo/config-plugins');

// The default `reactNativeArchitectures` builds four ABIs into one universal
// APK. Two of them — x86 and x86_64 — exist for emulators; no retailer's handset
// runs them, and each carries a full copy of the native libraries. Dropping
// them is roughly 30 MB off an internal-distribution APK and costs nothing.
//
// arm64-v8a covers every modern phone, armeabi-v7a the budget 32-bit devices
// still common in the field. Do NOT trim armeabi-v7a to save more: those are
// exactly the devices this app ships to.
const ABIS = 'armeabi-v7a,arm64-v8a';

module.exports = function withAndroidAbis(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = [
      ...cfg.modResults.filter(
        (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures')
      ),
      { type: 'property', key: 'reactNativeArchitectures', value: ABIS },
    ];
    return cfg;
  });
};
