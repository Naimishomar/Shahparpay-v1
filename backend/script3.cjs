const fs = require('fs');
const content = fs.readFileSync('C:/Users/naimi/.gemini/antigravity-ide/brain/3efc38ce-70c7-43b7-945b-6ff93dd53ff5/.system_generated/steps/435/content.md', 'utf8');
const idx = content.indexOf('"url":"/service-api/api/v1/service/aeps/kyc/v5/authentication"');
if (idx !== -1) {
    console.log(content.substring(idx - 100, idx + 1000));
} else {
    console.log("NOT FOUND 1");
}

const idx2 = content.indexOf('v5/authentication');
if (idx2 !== -1) {
    console.log("v5 auth:", content.substring(idx2 - 100, idx2 + 1000));
}

const idx3 = content.indexOf('auth_login');
if (idx3 !== -1) {
    console.log("auth_login:", content.substring(idx3 - 100, idx3 + 1000));
}
