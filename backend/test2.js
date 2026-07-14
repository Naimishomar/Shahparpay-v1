import jwt from 'jsonwebtoken';
import fs from 'fs';

const jwtKeyBase64 = 'UFMwMDQzNDdkNDIyYzJlZGViM2IxZmJhOWM4YTMyODkzMTZkNzZjMDE2ODk3ODM0NTE=';
const authorisedKey = 'ODI0OTg2NDhlMDVkNmU3OTk0NzQ2MmM2NTY3YzQzN2Y=';
const baseUrl = 'https://api.paysprint.in/api/v1';

const generatePaySprintToken = () => {
    const secret = Buffer.from(jwtKeyBase64, 'base64').toString('utf8');
    const partnerId = secret.substring(0, 8); 
    const currentUnixTime = Math.floor(Date.now() / 1000);
    const payload = {
        timestamp: currentUnixTime,
        partnerId: partnerId,
        reqid: Math.floor(Math.random() * 1000000).toString(),
        iat: currentUnixTime - 60
    };
    return jwt.sign(payload, jwtKeyBase64, { algorithm: 'HS256' });
};

const prefixes = ['', '/service'];
const services = ['/wallet', '/wallet-money', '/payout', '/aeps', '/api'];
const modules = ['/transact', '/wallet', '/payout'];
const submodules = ['/transact', '/wallet', '/payout', '/fundtransfer'];
const actions = ['/dotransaction', '/do_transaction', '/fundtransfer', '/transfer', '/cdtocc', '/send'];

let endpointsToTry = [];
for (const p of prefixes) {
    for (const s of services) {
        for (const m of modules) {
            for (const sm of submodules) {
                for (const a of actions) {
                    endpointsToTry.push(`${p}${s}${m}${sm}${a}`);
                }
            }
        }
    }
}

// Add some known structures just in case
endpointsToTry.push('/service/wallet/wallet/cdtocc');
endpointsToTry.push('/wallet-money/transact/transact/cdtocc');
endpointsToTry.push('/service/aeps/payout/dotransaction');
endpointsToTry.push('/service/aeps/wallet/dotransaction');
endpointsToTry.push('/service/wallet/wallet/fundtransfer');
endpointsToTry.push('/service/wallet/transact/transact/dotransaction');
endpointsToTry.push('/service/transact/transact/dotransaction');
endpointsToTry.push('/service/wallet-money/transact/transact/dotransaction');
endpointsToTry.push('/service/wallet/wallet/wallet_transfer');

endpointsToTry = [...new Set(endpointsToTry)]; // deduplicate

async function testEndpoints() {
    fs.writeFileSync('content.md', '# PaySprint API Tests\n\n');
    console.log(`Testing ${endpointsToTry.length} endpoints...`);
    
    // Batch requests to speed up (50 at a time)
    const batchSize = 50;
    for (let i = 0; i < endpointsToTry.length; i += batchSize) {
        const batch = endpointsToTry.slice(i, i + batchSize);
        await Promise.all(batch.map(async (endpoint) => {
            const token = generatePaySprintToken();
            const headers = {
                'Token': token,
                'Authorisedkey': authorisedKey,
                'Content-Type': 'application/json'
            };

            const payload = {
                merchant_code: "TEST1234",
                amount: "100",
                referenceid: "TXN123456"
            };

            try {
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                if (res.status !== 404 && !text.includes('<!DOCTYPE html>')) {
                    const msg = `[SUCCESS/JSON] Found potential endpoint: ${endpoint}\nResponse: ${text.substring(0, 500)}\n\n`;
                    console.log(msg);
                    fs.appendFileSync('content.md', msg);
                }
            } catch (e) {
                // Ignore errors for speed
            }
        }));
    }
    console.log("Finished testing endpoints.");
}

testEndpoints();
