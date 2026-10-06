const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');

// PaySprint MATM (Fino) ships as AARs PaySprint hands over (not on Maven):
// plugins/matm-libs/ holds them plus PaySprint's Fino_implementation.txt.
// Steps mirror that file and https://pay-sprint.readme.io/reference/fino-matm-new.
const LIB_DIR = path.join(__dirname, 'matm-libs');
const AARS = fs.existsSync(LIB_DIR) ? fs.readdirSync(LIB_DIR).filter((f) => f.endsWith('.aar')) : [];
const MARKER = '// withPaysprintMatm';

module.exports = function withPaysprintMatm(config) {
  if (AARS.length < 2) {
    // Build without the SDK; the MATM screen tells the retailer it is missing.
    console.warn('[withPaysprintMatm] PaySprint MATM AARs not found in plugins/matm-libs — MATM SDK skipped.');
    return config;
  }

  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const libs = path.join(cfg.modRequest.platformProjectRoot, 'app', 'libs');
      fs.mkdirSync(libs, { recursive: true });
      AARS.forEach((f) => fs.copyFileSync(path.join(LIB_DIR, f), path.join(libs, f)));
      return cfg;
    },
  ]);

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg;
    cfg.modResults.contents = cfg.modResults.contents
      .replace(/defaultConfig\s*{/, (m) => `${m}\n        multiDexEnabled true`)
      .replace(
        /dependencies\s*{/,
        // finosdk bundles its own BouncyCastle; the Maven copies (pulled in by
        // expo-updates, only used for update code signing, which we don't
        // configure) then fail checkDuplicateClasses.
        (m) => `configurations.all {
    exclude group: 'org.bouncycastle', module: 'bcprov-jdk15to18'
    exclude group: 'org.bouncycastle', module: 'bcutil-jdk15to18'
}

${m}
    ${MARKER}
    ${AARS.map((f) => `implementation files('libs/${f}')`).join('\n    ')}
    implementation 'androidx.multidex:multidex:2.0.1'
    implementation 'com.android.support:design:27.1.1'
    implementation 'com.android.support:cardview-v7:27.1.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'de.greenrobot:greendao:2.1.0'
    implementation 'org.greenrobot:eventbus:3.0.0'
    implementation 'com.karumi:dexter:4.2.0'
    // MatmHostActivity.onCreate calls EdgeToEdge.enable (activity 1.8+); expo only brings 1.7.2.
    implementation 'androidx.activity:activity:1.8.0'
    // MatmHostActivity calls PaySprint over retrofit + gson + okhttp logging.
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.9.1'`
      );
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((i) => i.key !== 'android.enableJetifier');
    cfg.modResults.push({ type: 'property', key: 'android.enableJetifier', value: 'true' });
    return cfg;
  });

  // Without this the SDK crashes on launch: FinoApplication.register on null.
  config = withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('FinoApplication.init')) {
      cfg.modResults.contents = src.replace(
        /super\.onCreate\(\);?/,
        (m) => `${m}\n    com.finopaytech.finosdk.helpers.FinoApplication.init(this)`
      );
    }
    return cfg;
  });

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application[0];
    app.$['tools:replace'] = 'android:theme,android:allowBackup';
    const service = 'com.anfu.pos.library.bluetooth4.BluetoothLeService';
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== service);
    app.service.push({ $: { 'android:name': service, 'android:enabled': 'true' } });
    return cfg;
  });
};
