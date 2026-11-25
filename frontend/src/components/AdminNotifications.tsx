import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Loader2, Send } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { BUTTON, FIELD, ICON_BUTTON, ago } from './distributor/shared';
import { Empty, PageHeader, Panel, Segmented, Skeleton } from './distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

// A kind is a status, so it keeps a status colour; said as a dot, not a tinted tile.
const KINDS = {
    info: { label: 'Information', dot: 'bg-sky-500' },
    success: { label: 'Success', dot: 'bg-[var(--lp-positive)]' },
    warning: { label: 'Warning', dot: 'bg-amber-500' },
    urgent: { label: 'Urgent', dot: 'bg-[var(--lp-danger)]' },
} as const;
type Kind = keyof typeof KINDS;
const kindOf = (k: string) => KINDS[(k as Kind)] || KINDS.info;

const EMPTY = { title: '', message: '', kind: 'info', showInTicker: true, expiresAt: '' };

const AdminNotifications = () => {
    const { token } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/notifications`;
    const [items, setItems] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY);

    const load = async () => {
        const res = await axios.get(api, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setItems(res.data.data || []);
    };
    useEffect(() => { if (token) load().catch(() => undefined).finally(() => setLoaded(true)); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const publish = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.title.trim() || !form.message.trim()) return toast.error('Enter a title and message');
        setSaving(true);
        try {
            const res = await axios.post(api, form, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { toast.success('Notification published'); setForm(EMPTY); load(); }
        } catch (error: any) { toast.error(error.response?.data?.message || 'Could not publish notification'); }
        finally { setSaving(false); }
    };

    const archive = async (id: string) => {
        try { await axios.delete(`${api}/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setItems((rows) => rows.filter((row) => row._id !== id)); toast.success('Notification archived'); }
        catch { toast.error('Could not archive notification'); }
    };

    const preview = kindOf(form.kind);
    const LBL = 'text-[13px] text-muted-foreground';

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Platform"
                title="Notifications"
                description="Announcements every retailer and distributor sees in their bell, and in the app's Latest Updates ticker."
            />

            <div className="grid gap-6 xl:grid-cols-5">
                <Panel className="xl:col-span-3" title="New announcement">
                    <form onSubmit={publish} className="flex flex-col gap-5">
                        <label className="flex flex-col gap-1.5">
                            <span className="flex justify-between"><span className={LBL}>Title</span><span className="lp-figure text-[12px] text-muted-foreground">{form.title.length}/120</span></span>
                            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="e.g. AEPS maintenance tonight" className={FIELD} />
                        </label>
                        <div className="flex flex-col gap-1.5">
                            <span className={LBL}>Type</span>
                            <div>
                                <Segmented
                                    label="Announcement type"
                                    value={form.kind as Kind}
                                    onChange={(k) => setForm({ ...form, kind: k })}
                                    options={(Object.keys(KINDS) as Kind[]).map((k) => [k, KINDS[k].label] as const)}
                                />
                            </div>
                        </div>
                        <label className="flex flex-col gap-1.5">
                            <span className="flex justify-between"><span className={LBL}>Message</span><span className="lp-figure text-[12px] text-muted-foreground">{form.message.length}/1000</span></span>
                            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} rows={5} placeholder="Write the announcement…" className={`${FIELD} h-auto resize-y py-2.5`} />
                        </label>
                        <div className="grid gap-4 border-t pt-5 sm:grid-cols-2 sm:items-end">
                            <label className="flex cursor-pointer items-center gap-3 text-sm">
                                <input type="checkbox" checked={form.showInTicker} onChange={(e) => setForm({ ...form, showInTicker: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                                <span><span className="text-foreground">Show in ticker</span><span className="block text-[12px] text-muted-foreground">Scrolls across the top of dashboards</span></span>
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className={LBL}>Expires (optional)</span>
                                <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={`${FIELD} dark:[color-scheme:dark]`} />
                            </label>
                        </div>
                        <div className="flex justify-end">
                            <button disabled={saving} className={BUTTON}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} strokeWidth={1.75} />} {saving ? 'Publishing…' : 'Publish'}
                            </button>
                        </div>
                    </form>
                </Panel>

                {/* The announcement as users will see it: the bell item, then the ticker line. */}
                <Panel className="xl:col-span-2" title="Preview" description="Exactly as it reads in the bell.">
                    <div className="rounded-xl border bg-background p-4">
                        <div className="flex items-start gap-3">
                            <span aria-hidden className={`mt-1.5 size-2 flex-none rounded-full ${preview.dot}`} />
                            <div className="min-w-0">
                                <p className="text-sm text-foreground">{form.title || 'Your title'}</p>
                                <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{form.message || 'Your message appears here, exactly as users will read it.'}</p>
                                <p className="mt-2 text-[12px] text-muted-foreground">Just now · {preview.label}</p>
                            </div>
                        </div>
                    </div>
                    {form.showInTicker && (
                        <div className="mt-3 overflow-hidden rounded-xl bg-foreground px-4 py-2.5 text-[13px] text-background">
                            <span className="opacity-70">Latest · </span>{form.title || 'Your title'}
                        </div>
                    )}
                </Panel>
            </div>

            <Panel title="Active announcements" action={<span className="text-[13px] text-muted-foreground"><span className="lp-figure text-foreground">{items.length}</span> live</span>} flush>
                {!loaded ? (
                    <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : items.length === 0 ? (
                    <Empty>No active announcements.</Empty>
                ) : (
                    <ul>
                        {items.map((item) => {
                            const k = kindOf(item.kind);
                            return (
                                <li key={item._id} className="flex items-start gap-4 border-b px-5 py-4 last:border-0">
                                    <span aria-hidden title={k.label} className={`mt-1.5 size-2 flex-none rounded-full ${k.dot}`} />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm text-foreground">{item.title}</h3>
                                        <p className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{item.message}</p>
                                        <p className="mt-2 text-[12px] text-muted-foreground">
                                            {k.label} · published {ago(item.createdAt)}
                                            {item.showInTicker && ' · in ticker'}
                                            {item.expiresAt && ` · expires ${new Date(item.expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => archive(item._id)} className={ICON_BUTTON} title="Archive" aria-label={`Archive ${item.title}`}>
                                        <Archive className="h-4 w-4" strokeWidth={1.75} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>
        </div>
    );
};

export default AdminNotifications;
