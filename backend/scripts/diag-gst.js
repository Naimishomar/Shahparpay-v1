import 'dotenv/config';
import mongoose from 'mongoose';
import { getWalletLedger } from '../src/controllers/walletLedger.controller.js';

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const uid = '6a4dcb5e56d4632db3d4eb87';
    const call = (query) => new Promise((resolve) => {
        const req = { user: { id: uid, retailerId: 'A2ZB1005' }, query };
        const res = { status: (code) => ({ json: (body) => resolve({ code, body }) }) };
        getWalletLedger(req, res);
    });

    const all = await call({});
    const rows = all.body.data;
    console.log('currentAeps:', all.body.currentAeps, ' currentMain:', all.body.currentMain, ' total:', rows.length);

    // AEPS view
    const aeps = await call({ wallet: 'AEPS' });
    const e = aeps.body.data;
    console.log('\nAEPS-only total:', e.length);
    console.log('AEPS oldest: OPENING', e[e.length-1].OPENING, 'CLOSING', e[e.length-1].CLOSING);
    console.log('AEPS newest: OPENING', e[0].OPENING, 'CLOSING', e[0].CLOSING, '== header?', e[0].CLOSING === all.body.currentAeps);

    // Verify GST netting: find AEPS_WITHDRAWAL rows with commission, check closing = opening + amount + (commission - gst)
    console.log('\nAEPS_WITHDRAWAL rows with commission (sample 5):');
    let ok = true;
    const comm = e.filter(r => r.COMMISSION > 0).slice(0, 5);
    for (const r of comm) {
        const expected = Math.round((r.OPENING + r.AMOUNT + (r.COMMISSION - r.GST)) * 100) / 100;
        const match = Math.abs(expected - r.CLOSING) < 0.011;
        if (!match) ok = false;
        console.log(`AMOUNT=${r.AMOUNT} COMM=${r.COMMISSION} GST=${r.GST} OPENING=${r.OPENING} CLOSING=${r.CLOSING} expectedNetClosing=${expected} match=${match}`);
    }

    // negatives check
    const negAeps = e.filter(r => r.CLOSING < -0.001);
    console.log('\nnegative AEPS closings:', negAeps.length);
    console.log('all commission rows net correctly?', ok);

    // No username heading/field
    const hasUsername = rows.some(r => 'USERNAME' in r);
    console.log('backend still sends USERNAME field?', hasUsername);

    await mongoose.disconnect();
    process.exit(0);
};
run().catch(e => { console.error(e); process.exit(1); });
