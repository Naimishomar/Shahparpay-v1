import { inr } from '../../distributor/shared';
import type { TxnQuery } from '../TransactionExplorer';

export type IcchWallet = { id: number; name: string; number: string; isPrimary: boolean; balance: number; available: number; hold: number; active: boolean };

export type Role = 'principal' | 'commission' | 'charge' | 'refund' | 'tds' | 'internal';

export type LedgerRow = {
    id: number; details: string | null; type: 'CR' | 'DR'; amount: number; preBalance: number; balance: number; date: string | null;
    label: string; role: Role; ref: string | null;
};

/** One of our transactions, as the Icchhamati views show it beside a statement line. */
export type OurTxn = {
    id: string; transactionId: string; type: string; status: string; amount: number; createdAt: string;
    retailer: { id: string; name: string; retailerId?: string; businessName?: string } | null;
    commissions: { retailerEarned?: number; distributorEarned?: number; adminEarned?: number; chargeDeducted?: number } | null;
    message: string | null;
};

export type Page<T> = { rows: T[]; page: number; lastPage: number; total: number };

/** What every Icchhamati view gets from the page: the token and the ways out to the rest of the console. */
export type ViewProps = {
    token: string | null;
    onOpenTransactions: (q: TxnQuery) => void;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
};

export const ROLE_LABEL: Record<Role, string> = {
    principal: 'Transaction',
    commission: 'Commission',
    charge: 'Charge',
    refund: 'Refund',
    tds: 'TDS',
    internal: 'Internal',
};

/** Icchhamati stamps times in IST without a zone. */
export const istDate = (value?: string | null) => (value ? new Date(`${value.trim().replace(' ', 'T')}+05:30`) : null);

export const timeOf = (value?: string | null) => istDate(value)?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) ?? '—';
export const dateTimeOf = (value?: string | null) =>
    istDate(value)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) ?? '—';

export const dayHeading = (value?: string | null) => {
    const d = istDate(value);
    if (!d) return 'Undated';
    const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (key(d) === key(today)) return 'Today';
    if (key(d) === key(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

/** Today in IST as YYYY-MM-DD, for date inputs. */
export const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export const signed = (type: 'CR' | 'DR', amount: number) => `${type === 'CR' ? '+' : '−'}${inr.format(amount)}`;
