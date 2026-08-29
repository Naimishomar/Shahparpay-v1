const { withGradleProperties, withAppBuildGradle } = require('@expo/config-plugins');

// x86 and x86_64 exist for emulators; no retailer's handset runs them, and each
// carries a full copy of the native libraries — measured at 13.5 MB and 13.7 MB
// of a 62 MB APK.
//
// arm64-v8a covers every modern phone, armeabi-v7a the budget 32-bit devices
// still common in the field. Do NOT trim armeabi-v7a to save more: those are
// exactly the devices this app ships to.
const ABIS = ['armeabi-v7a', 'arm64-v8a'];

// reactNativeArchitectures only governs what Gradle builds FROM SOURCE. React
// Native ships prebuilt AARs holding all four ABIs, so without abiFilters the
// x86 libraries are unpacked and packaged anyway — which is what was happening.
const MARKER = '// withAndroidAbis';

module.exports = function withAndroidAbis(config) {
  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = [
      ...cfg.modResults.filter(
        (item) => !(item.type === 'property' && item.key === 'reactNativeArchitectures')
      ),
      { type: 'property', key: 'reactNativeArchitectures', value: ABIS.join(',') },
    ];
    return cfg;
  });

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    const abis = ABIS.map((a) => `"${a}"`).join(', ');
    // Anchored on defaultConfig so the filter lands in the block Gradle reads
    // when packaging, not in a buildType that only applies to one variant.
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /defaultConfig\s*{/,
      `defaultConfig {\n        ${MARKER}\n        ndk {\n            abiFilters ${abis}\n        }`
    );
    return cfg;
  });
};
