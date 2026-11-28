import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, Bell, BellOff, Loader2, RefreshCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_QUIET, FIELD, inr, useApiGet } from '../distributor/shared';
import { PageHeader, Panel, Segmented, Skeleton } from '../distributor/ui';
import { ALERT_ERROR } from '../landing/ui';
import type { TxnQuery } from './TransactionExplorer';
import type { IcchWallet } from './icchhamati/shared';
import Ledger from './icchhamati/Ledger';
import Payouts from './icchhamati/Payouts';
import Reconcile from './icchhamati/Reconcile';
import StatusCheck from './icchhamati/StatusCheck';
import Beneficiaries from './icchhamati/Beneficiaries';
import AepsOnboarding from './icchhamati/AepsOnboarding';

const LBL = 'text-[13px] text-muted-foreground';
const API = import.meta.env.VITE_BACKEND_URL;

type Alerts = { thresholds: Record<string, number>; alerted: Record<string, string> };

const VIEWS = [
    ['ledger', 'Ledger'],
    ['payouts', 'Payouts'],
    ['reconcile', 'Reconcile'],
    ['status', 'Status check'],
    ['beneficiaries', 'Beneficiaries'],
    ['aeps', 'AEPS onboarding'],
] as const;
type View = (typeof VIEWS)[number][0];

/** One wallet: what is available, and the line under which admins are told to top it up. */
const WalletCard = ({ w, line, token, onSaved }: { w: IcchWallet; line?: number; token: string | null; onSaved: (a: Alerts) => void }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(line ? String(line) : '');
    const [saving, setSaving] = useState(false);
    const low = Boolean(line) && w.available < (line || 0);

    const save = async (threshold: number) => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/admin/icchhamati/alerts`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ walletId: w.id, threshold }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(json.message);
            onSaved(json.data);
            setEditing(false);
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Could not save the alert');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`bg-card p-5 ${low ? 'bg-[var(--lp-danger-soft)]' : ''}`}>
            <div className="flex items-center justify-between gap-2">
                <p className={LBL}>{w.name}</p>
                <span className="flex items-center gap-2 text-[12px]">
                    {low && <span className="font-medium text-[var(--lp-danger)]">Low balance</span>}
                    {w.isPrimary && <span className="text-foreground">Primary</span>}
                </span>
            </div>
            <p className="lp-figure mt-2 text-[26px] leading-none tracking-[-0.02em] text-foreground">{inr.format(w.available)}</p>
            <p className="mt-2 text-[12px] text-muted-foreground">
                <span className="lp-figure">{w.number}</span>{w.hold > 0 && <> · {inr.format(w.hold)} on hold</>}{!w.active && ' · inactive'}
            </p>

            {editing ? (
                <form onSubmit={(e) => { e.preventDefault(); save(Number(value) || 0); }} className="mt-4 flex items-center gap-2">
                    <input autoFocus value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Alert below ₹" aria-label={`Alert when ${w.name} falls below`} className={`${FIELD} lp-figure h-9`} />
                    <button disabled={saving} className={`${BUTTON} h-9 px-3`}>{saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}</button>
                    <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
                </form>
            ) : (
                <div className="mt-4 flex items-center gap-3 text-[13px]">
                    <button type="button" onClick={() => { setValue(line ? String(line) : ''); setEditing(true); }} className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
                        <Bell size={14} /> {line ? <>Alert below <span className="lp-figure">{inr.format(line)}</span></> : 'Set low-balance alert'}
                    </button>
                    {line ? <button type="button" disabled={saving} onClick={() => save(0)} aria-label="Turn alert off" title="Turn alert off" className="text-muted-foreground hover:text-foreground"><BellOff size={14} /></button> : null}
                </div>
            )}
        </div>
    );
};

/** Moving money out of the primary wallet into another of ours; Icchhamati allows no other direction. */
const MoveMoney = ({ token, primary, targets, onDone, onClose }: { token: string | null; primary: IcchWallet; targets: IcchWallet[]; onDone: () => void; onClose: () => void }) => {
    const [transfer, setTransfer] = useState({ targetAccountId: targets.length === 1 ? String(targets[0].id) : '', amount: '', mpin: '', details: '' });
    const [sending, setSending] = useState(false);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transfer.targetAccountId) return toast.error('Choose the wallet to transfer into.');
        if (!(Number(transfer.amount) > 0)) return toast.error('Enter a valid amount.');
        if (!/^\d{4}$/.test(transfer.mpin)) return toast.error('Enter the 4-digit Icchhamati MPIN.');
        const target = targets.find((w) => String(w.id) === transfer.targetAccountId);
        if (!window.confirm(`Move ${inr.format(Number(transfer.amount))} from ${primary.name} to ${target?.name}?`)) return;
        setSending(true);
        try {
            const res = await fetch(`${API}/api/admin/icchhamati/self-transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(transfer),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            toast.success(json.message || 'Transfer completed');
            setTransfer((t) => ({ ...t, amount: '', details: '' }));
            onDone();
        } catch (error) {
            toast.error(error instanceof Error && error.message ? error.message : 'Transfer failed');
        } finally {
            // The MPIN is never kept around after an attempt.
            setTransfer((t) => ({ ...t, mpin: '' }));
            setSending(false);
        }
    };

    return (
        <Panel title="Move money between wallets" description={`From ${primary.name} (${inr.format(primary.available)} available) into another of our wallets. Nothing leaves the account.`}
            action={<button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>}>
            <form onSubmit={send} className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
                <label className="flex flex-col gap-1.5"><span className={LBL}>To</span>
                    <select value={transfer.targetAccountId} onChange={(e) => setTransfer({ ...transfer, targetAccountId: e.target.value })} className={FIELD}>
                        <option value="" disabled>Select wallet</option>
                        {targets.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.number})</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1.5"><span className={LBL}>Amount</span>
                    <input value={transfer.amount} onChange={(e) => setTransfer({ ...transfer, amount: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder={`Up to ${inr.format(primary.available)}`} className={`${FIELD} lp-figure`} />
                </label>
                <label className="flex flex-col gap-1.5"><span className={LBL}>Icchhamati MPIN</span>
                    <input value={transfer.mpin} onChange={(e) => setTransfer({ ...transfer, mpin: e.target.value.replace(/\D/g, '').slice(0, 4) })} type="password" inputMode="numeric" autoComplete="off" className={`${FIELD} lp-figure tracking-[0.4em]`} />
                </label>
                <label className="flex flex-col gap-1.5"><span className={LBL}>Note (optional)</span>
                    <input value={transfer.details} onChange={(e) => setTransfer({ ...transfer, details: e.target.value })} className={FIELD} />
                </label>
                <button disabled={sending} className={BUTTON}>{sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={1.75} />} Transfer</button>
            </form>
        </Panel>
    );
};

/**
 * Shahparpay's own Icchhamati account: the float every retailer transacts
 * through. Wallets on top, then one view at a time so the page never becomes a
 * wall of tables.
 */
const IcchhamatiAccount = ({ token, onOpenTransactions, onOpenUser }: {
    token: string | null;
    onOpenTransactions: (q: TxnQuery) => void;
    onOpenUser: (role: 'retailer' | 'distributor', id: string) => void;
}) => {
    const wallets = useApiGet<IcchWallet[]>(token, '/api/admin/icchhamati/wallets');
    const alerts = useApiGet<Alerts>(token, '/api/admin/icchhamati/alerts');
    const [savedAlerts, setSavedAlerts] = useState<Alerts | null>(null);
    const thresholds = (savedAlerts ?? alerts.data)?.thresholds ?? {};
    const [nonce, setNonce] = useState(0);
    const [moving, setMoving] = useState(false);
    const [params, setParams] = useSearchParams();
    const view: View = VIEWS.some(([k]) => k === params.get('view')) ? (params.get('view') as View) : 'ledger';

    const primary = wallets.data?.find((w) => w.isPrimary);
    const targets = wallets.data?.filter((w) => !w.isPrimary && w.active) ?? [];
    const refresh = () => { wallets.reload(); setNonce((n) => n + 1); };
    const props = { token, onOpenTransactions, onOpenUser };

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Admin only"
                title="Icchhamati account"
                description="The company float every retailer transacts through: its wallets, what moved through them, and whether it agrees with Shahparpay."
                actions={<>
                    {primary && targets.length > 0 && !moving && (
                        <button type="button" onClick={() => setMoving(true)} className={BUTTON_QUIET}><ArrowLeftRight size={16} strokeWidth={1.75} /> Move money</button>
                    )}
                    <button type="button" onClick={refresh} className={BUTTON_QUIET}><RefreshCcw size={16} strokeWidth={1.75} className={wallets.loading ? 'animate-spin' : ''} /> Refresh</button>
                </>}
            />

            {wallets.error && <p className={ALERT_ERROR}>{wallets.error}</p>}

            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3">
                    {wallets.loading && !wallets.data
                        ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-24" /></div>)
                        : wallets.data?.map((w) => <WalletCard key={`${w.id}-${thresholds[w.id] ?? 0}`} w={w} line={thresholds[w.id]} token={token} onSaved={setSavedAlerts} />)}
                </div>
                {wallets.loading && !wallets.data && <p className="border-t px-5 py-2.5 text-[12px] text-muted-foreground">Asking Icchhamati for balances. This can take a few seconds.</p>}
            </section>

            {moving && primary && <MoveMoney token={token} primary={primary} targets={targets} onDone={refresh} onClose={() => setMoving(false)} />}

            <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <Segmented label="View" value={view} onChange={(v) => setParams((p) => { p.set('view', v); return p; }, { replace: true })} options={VIEWS} />
            </div>

            {view === 'ledger' && <Ledger {...props} wallets={wallets.data} nonce={nonce} />}
            {view === 'payouts' && <Payouts token={token} nonce={nonce} />}
            {view === 'reconcile' && <Reconcile {...props} />}
            {view === 'status' && <StatusCheck {...props} />}
            {view === 'beneficiaries' && <Beneficiaries token={token} nonce={nonce} />}
            {view === 'aeps' && <AepsOnboarding token={token} nonce={nonce} onOpenUser={onOpenUser} />}
        </div>
    );
};

export default IcchhamatiAccount;
