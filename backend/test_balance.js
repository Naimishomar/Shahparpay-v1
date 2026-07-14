import 'dotenv/config';
import { fetchAepsBalance, fetchMainBalance } from './src/utils/paysprint.util.js';

async function test() {
    // We don't know the exact merchant code, but we can try something generic or 
    // if the user has a sandbox account, 'TEST1234'. Let's just use a dummy one.
    // Actually, maybe we can fetch a user from the db.
    
    import('./src/models/users/retailer.model.js').then(async (module) => {
        const Retailer = module.default;
        // Mock mongoose connection just to see the env logic? No, let's just test the API directly.
    });

    console.log("Testing AEPS Balance with generic merchant...");
    const aeps = await fetchAepsBalance("A2ZB1004");
    console.log("AEPS Result:", aeps);
}

test();
