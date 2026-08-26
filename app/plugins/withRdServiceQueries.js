const { withAndroidManifest } = require('@expo/config-plugins');

// Android 11+ hides other packages from us. Launching a UIDAI RD Service by
// explicit package name (which is what pins the capture to the scanner brand
// the retailer picked) throws ActivityNotFoundException unless the manifest
// declares the intents and packages below.
const RD_ACTIONS = [
  'in.gov.uidai.rdservice.fp.INFO',
  'in.gov.uidai.rdservice.fp.CAPTURE',
];

const RD_PACKAGES = [
  'com.mantra.rdservice',
  'com.scl.rdservice',
  'com.acpl.registersdk',
  'com.secugen.rdservice',
  'com.evolute.rdservice',
];

module.exports = function withRdServiceQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries?.length ? manifest.queries : [{}];
    const queries = manifest.queries[0];

    queries.intent = [
      ...(queries.intent ?? []).filter(
        (entry) => !RD_ACTIONS.includes(entry?.action?.[0]?.$?.['android:name'])
      ),
      ...RD_ACTIONS.map((action) => ({
        action: [{ $: { 'android:name': action } }],
      })),
    ];

    queries.package = [
      ...(queries.package ?? []).filter(
        (entry) => !RD_PACKAGES.includes(entry?.$?.['android:name'])
      ),
      ...RD_PACKAGES.map((name) => ({ $: { 'android:name': name } })),
    ];

    return cfg;
  });
};
