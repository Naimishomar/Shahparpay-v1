const fs = require('fs');
const html = fs.readFileSync('C:/Users/naimi/.gemini/antigravity-ide/brain/93f31ecc-611b-4618-a9d4-628f24bb87c6/.system_generated/steps/6188/content.md', 'utf8');
const match = html.match(/\/service-api\/api\/v1\/service\/dmt[^<"'\s]+/gi);
console.log([...new Set(match)]);
