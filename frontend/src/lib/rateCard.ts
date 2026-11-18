/**
 * The /api/commission rate card as display sections. The backend reads every
 * figure from the functions that credit the wallet, so nothing here is retyped.
 */
type Slab = { label: string; sample: number; earns: number };
type Operator = { name: string; percent: number };
type Biller = { name: string; kind: 'flat' | 'percent'; value: number };

export type Rates = {
    aeps: { withdrawal: Slab[]; deposit: Slab[]; tdsPercent: number };
    matm: Slab[];
    upiCashWithdrawal: Slab[];
    pan: { fee: number; earns: number };
    charges: { name: string; fee: number; plusGst: boolean }[];
    leads: { name: string; earns: number }[];
    prepaid: Operator[];
    dth: Operator[];
    bbps: Biller[];
    onRequest: string[];
};

export type RateRow = { left: string; right: string; muted?: boolean };
export type RateSection = { key: string; title: string; note: string; rows: RateRow[] };

export const rupees = (value: number) =>
    `₹${value.toLocaleString('en-IN', { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

const slabRows = (slabs: Slab[], perSample: boolean): RateRow[] =>
    slabs.map((s) => ({
        left: s.label,
        right: s.earns ? (perSample ? `${rupees(s.earns)} on ${rupees(s.sample)}` : rupees(s.earns)) : 'No commission',
        muted: !s.earns,
    }));

export const rateSections = (r: Rates): RateSection[] => {
    const tds = `${r.aeps.tdsPercent}% TDS is deducted.`;
    return [
        { key: 'aeps', title: 'AEPS cash withdrawal', note: `Per transaction. ${tds}`, rows: slabRows(r.aeps.withdrawal, true) },
        { key: 'upicw', title: 'UPI cash withdrawal', note: `Flat per transaction, ₹500 to ₹5,000. ${tds}`, rows: slabRows(r.upiCashWithdrawal ?? [], false) },
        { key: 'cd', title: 'AEPS cash deposit', note: `Per transaction. ${tds}`, rows: slabRows(r.aeps.deposit, false) },
        { key: 'matm', title: 'Micro ATM cash withdrawal', note: `Per transaction. ${tds}`, rows: slabRows(r.matm, true) },
        { key: 'prepaid', title: 'Mobile recharge', note: `Percentage of the recharge amount. ${tds}`, rows: r.prepaid.map((o) => ({ left: o.name, right: `${o.percent}%` })) },
        { key: 'dth', title: 'DTH recharge', note: 'Percentage of the recharge amount.', rows: r.dth.map((o) => ({ left: o.name, right: `${o.percent}%` })) },
        { key: 'bbps', title: 'BBPS bill payments', note: 'Flat per bill, except where a percentage is shown.', rows: r.bbps.map((b) => ({ left: b.name, right: b.kind === 'flat' ? rupees(b.value) : `${b.value}%` })) },
        { key: 'pan', title: 'PAN card', note: `Per application. ${tds}`, rows: [{ left: `Application at ${rupees(r.pan.fee)}`, right: rupees(r.pan.earns) }] },
        { key: 'leads', title: 'Lead generation', note: `Flat, once the lead is approved. ${tds}`, rows: r.leads.map((l) => ({ left: l.name, right: rupees(l.earns) })) },
        { key: 'charges', title: 'Service charges', note: 'Debited with the transaction and refunded if it fails.', rows: r.charges.map((c) => ({ left: c.name, right: `${rupees(c.fee)}${c.plusGst ? ' + GST' : ''}`, muted: true })) },
    ];
};
