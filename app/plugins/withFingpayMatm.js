const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');

// Fingpay Micro ATM SDK (via Icchhamati) with the Morefun mPOS driver. The
// vendor files are not on Maven; plugins/fingpay-matm-libs/ holds them.
// FingpayMatmActivity bridges JS (expo-intent-launcher) to the SDK.
const LIB_DIR = path.join(__dirname, 'fingpay-matm-libs');
const LIBS = fs.existsSync(LIB_DIR) ? fs.readdirSync(LIB_DIR).filter((f) => /\.(aar|jar)$/.test(f)) : [];
const BRIDGE = path.join(__dirname, 'fingpay-matm', 'FingpayMatmActivity.kt');
const PAYSPRINT_LIBS = path.join(__dirname, 'matm-libs');
const MARKER = '// withFingpayMatm';

module.exports = function withFingpayMatm(config) {
  if (LIBS.length < 2) {
    console.warn('[withFingpayMatm] Fingpay MATM SDK not found in plugins/fingpay-matm-libs — skipped.');
    return config;
  }

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const libs = path.join(root, 'app', 'libs');
      fs.mkdirSync(libs, { recursive: true });
      LIBS.forEach((f) => fs.copyFileSync(path.join(LIB_DIR, f), path.join(libs, f)));
      const pkg = path.join(root, 'app', 'src', 'main', 'java', 'com', 'shahparpay', 'app');
      fs.mkdirSync(pkg, { recursive: true });
      fs.copyFileSync(BRIDGE, path.join(pkg, 'FingpayMatmActivity.kt'));
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    // The SDK uses BouncyCastle; PaySprint's finosdk AAR already bundles it
    // (and withPaysprintMatm excludes the Maven copies), so add it only without that AAR.
    const finoBundlesBc = fs.existsSync(PAYSPRINT_LIBS) && fs.readdirSync(PAYSPRINT_LIBS).some((f) => f.startsWith('finosdk'));
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*{/,
      (m) => `${m}
    ${MARKER}
    ${LIBS.map((f) => `implementation files('libs/${f}')`).join('\n    ')}
    implementation 'com.google.code.gson:gson:2.10.1'
    implementation 'commons-io:commons-io:2.11.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'${finoBundlesBc ? '' : "\n    implementation 'org.bouncycastle:bcprov-jdk15on:1.70'"}`
    );
    return cfg;
  });

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    // The SDK's manifest sets its own label and allowBackup on <application>.
    const replace = new Set(String(app.$['tools:replace'] || '').split(',').filter(Boolean));
    ['android:label', 'android:allowBackup'].forEach((a) => replace.add(a));
    app.$['tools:replace'] = [...replace].join(',');
    const name = '.FingpayMatmActivity';
    app.activity = (app.activity ?? []).filter((a) => a.$['android:name'] !== name);
    app.activity.push({
      $: {
        'android:name': name,
        'android:exported': 'false',
        'android:screenOrientation': 'portrait',
        'android:theme': '@style/Theme.AppCompat.Light.NoActionBar',
      },
    });
    return cfg;
  });
};
