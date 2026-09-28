import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Headset, Loader2, Paperclip, Search, Send, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { CARD, INPUT, SILVER_TILE, ago } from './distributor/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS = {
    OPEN: { label: 'Open', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20' },
    IN_PROGRESS: { label: 'In progress', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20' },
    RESOLVED: { label: 'Resolved', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20' },
    CLOSED: { label: 'Closed', cls: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 ring-zinc-500/20' },
} as const;
type Status = keyof typeof STATUS;
const pill = (s: string) => STATUS[s as Status] || STATUS.OPEN;

const AdminSupport = () => {
    const { token } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/support`;
    const headers = { headers: { Authorization: `Bearer ${token}` } };
    const [tickets, setTickets] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [selected, setSelected] = useState<any>(null);
    const [filter, setFilter] = useState<'active' | Status | 'all'>('active');
    const [query, setQuery] = useState('');
    const [reply, setReply] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [statusSaving, setStatusSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const threadEnd = useRef<HTMLDivElement>(null);

    const load = async () => {
        try {
            const res = await axios.get(api, headers);
            if (res.data.success) setTickets(res.data.data || []);
        } catch {
            toast.error('Could not load support tickets');
        } finally {
            setLoaded(true);
        }
    };
    useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { threadEnd.current?.scrollIntoView({ block: 'end' }); }, [selected?._id, selected?.messages?.length]);

    const sendReply = async () => {
        if (!selected || (!reply.trim() && !attachment)) return;
        setSaving(true);
        try {
            const form = new FormData();
            form.append('message', reply);
            if (attachment) form.append('attachment', attachment);
            const res = await axios.post(`${api}/${selected._id}/messages`, form, headers);
            if (res.data.success) { setSelected(res.data.data); setReply(''); setAttachment(null); load(); }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Could not send reply');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (next: string) => {
        if (!selected) return;
        setStatusSaving(true);
        try {
            const res = await axios.patch(`${api}/${selected._id}`, { status: next }, headers);
            if (res.data.success) { setSelected(res.data.data); load(); toast.success('Ticket status updated'); }
        } catch {
            toast.error('Could not update ticket status');
        } finally {
            setStatusSaving(false);
        }
    };

    const counts = tickets.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});
    const term = query.trim().toLowerCase();
    const visible = tickets
        .filter((t) => filter === 'all' || (filter === 'active' ? ['OPEN', 'IN_PROGRESS'].includes(t.status) : t.status === filter))
        .filter((t) => !term || [t.subject, t.userId?.name, t.userId?.businessName].some((v) => v?.toLowerCase().includes(term)));

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}><Headset className="h-7 w-7" /></div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Customer support</h1>
                            <p className="text-sm text-muted-foreground">Answer retailer and distributor requests and track them to resolution.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(STATUS) as Status[]).map((s) => (
                            <div key={s} className="rounded-xl border bg-background/70 backdrop-blur px-3 py-2 text-center">
                                <p className="text-lg font-bold tabular-nums">{counts[s] || 0}</p>
                                <p className="text-[11px] text-muted-foreground">{STATUS[s].label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Inbox — hidden on phones once a ticket is open */}
                <section className={`${CARD} flex flex-col overflow-hidden p-0 lg:col-span-2 ${selected ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="space-y-3 border-b p-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject or user" className={`${INPUT} pl-9`} />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {([['active', 'Active'], ['all', 'All'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
                                <button key={k} onClick={() => setFilter(k as typeof filter)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${filter === k ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900' : 'bg-background text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[640px] flex-1 overflow-y-auto">
                        {!loaded ? (
                            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />)}</div>
                        ) : visible.length === 0 ? (
                            <p className="p-10 text-center text-sm text-muted-foreground">No tickets here.</p>
                        ) : visible.map((t) => (
                            <button
                                key={t._id}
                                onClick={() => setSelected(t)}
                                className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${selected?._id === t._id ? 'bg-black/[0.05] dark:bg-white/[0.06]' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-sm font-semibold">{t.subject}</p>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${pill(t.status).cls}`}>{pill(t.status).label}</span>
                                </div>
                                <p className="mt-1 truncate text-xs text-muted-foreground">{t.userId?.name || t.userId?.businessName || 'User'} · {t.userModel}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">{ago(t.updatedAt)} · {(t.messages || []).length} messages</p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Conversation */}
                <section className={`${CARD} min-h-[560px] flex-col overflow-hidden p-0 lg:col-span-3 ${selected ? 'flex' : 'hidden lg:flex'}`}>
                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                            <div className={`mb-3 rounded-2xl p-3 ${SILVER_TILE}`}><Headset className="h-6 w-6" /></div>
                            <h3 className="text-lg font-semibold">Select a ticket</h3>
                            <p className="text-sm text-muted-foreground">Open a request to read the conversation and reply.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                                <div className="flex min-w-0 items-center gap-2">
                                    <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-black/5 lg:hidden dark:hover:bg-white/10" aria-label="Back to tickets"><ChevronLeft size={18} /></button>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-lg font-semibold">{selected.subject}</h3>
                                        <p className="truncate text-sm text-muted-foreground">{selected.userId?.name || selected.userId?.businessName} · {selected.userModel} · opened {ago(selected.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {statusSaving && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                                    <select value={selected.status} onChange={(e) => updateStatus(e.target.value)} disabled={statusSaving} className={`${INPUT} w-40 py-2`} aria-label="Ticket status">
                                        {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto bg-black/[0.015] p-5 dark:bg-white/[0.015]">
                                {(selected.messages || []).map((m: any, i: number) => {
                                    const mine = m.senderRole === 'admin' || m.senderRole === 'support';
                                    return (
                                        <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'rounded-br-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'rounded-bl-md border bg-card'}`}>
                                                <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                                                {m.attachments?.map((file: any) => (
                                                    <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mt-2 block">
                                                        <img src={file.url} alt={file.name || 'Attachment'} className="max-h-48 rounded-lg bg-black/10 object-contain" />
                                                    </a>
                                                ))}
                                                <p className="mt-1 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={threadEnd} />
                            </div>

                            <div className="space-y-2 border-t p-4">
                                {attachment && (
                                    <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
                                        <Paperclip size={12} /> {attachment.name}
                                        <button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={12} /></button>
                                    </span>
                                )}
                                <div className="flex gap-2">
                                    <textarea
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                        rows={1}
                                        placeholder="Reply… (Enter to send, Shift+Enter for a new line)"
                                        className={`${INPUT} min-h-[44px] resize-none`}
                                    />
                                    <label className="flex cursor-pointer items-center rounded-xl border bg-background px-3 hover:bg-black/5 dark:hover:bg-white/10" title="Attach image">
                                        <Paperclip className="h-4 w-4" />
                                        <input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" />
                                    </label>
                                    <button
                                        onClick={sendReply}
                                        disabled={saving || (!reply.trim() && !attachment)}
                                        className="flex items-center rounded-xl bg-zinc-900 px-4 text-white shadow-md disabled:opacity-50 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900"
                                        aria-label="Send reply"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AdminSupport;
