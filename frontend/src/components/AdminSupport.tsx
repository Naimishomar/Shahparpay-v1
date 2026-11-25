import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader2, Paperclip, Search, Send, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { BUTTON, FIELD, ICON_BUTTON, ago } from './distributor/shared';
import { Empty, PageHeader, Skeleton } from './distributor/ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS = {
    OPEN: { label: 'Open', dot: 'bg-amber-500' },
    IN_PROGRESS: { label: 'In progress', dot: 'bg-sky-500' },
    RESOLVED: { label: 'Resolved', dot: 'bg-[var(--lp-positive)]' },
    CLOSED: { label: 'Closed', dot: 'bg-muted-foreground' },
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

    const panel = 'flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card';

    return (
        <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
            <PageHeader
                eyebrow="Platform"
                title="Customer support"
                description={
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Answer retailer and distributor requests and track them to resolution.</span>
                        {(Object.keys(STATUS) as Status[]).map((st) => (
                            <span key={st} className="inline-flex items-center gap-1.5 text-[13px]">
                                <span aria-hidden className={`size-1.5 rounded-full ${STATUS[st].dot}`} />
                                <span className="lp-figure text-foreground">{counts[st] || 0}</span> {STATUS[st].label.toLowerCase()}
                            </span>
                        ))}
                    </span>
                }
            />

            <div className="grid gap-6 lg:grid-cols-5">
                {/* Inbox — hidden on phones once a ticket is open */}
                <section className={`${panel} lg:col-span-2 ${selected ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="space-y-3 border-b p-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject or user" className={`${FIELD} pl-9`} />
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {([['active', 'Active'], ['all', 'All'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
                                <button key={k} type="button" onClick={() => setFilter(k as typeof filter)} aria-pressed={filter === k} className={`h-7 rounded-lg px-2.5 text-[12px] transition-colors ${filter === k ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="max-h-[640px] flex-1 overflow-y-auto">
                        {!loaded ? (
                            <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                        ) : visible.length === 0 ? (
                            <Empty>No tickets here.</Empty>
                        ) : visible.map((t) => (
                            <button
                                key={t._id}
                                type="button"
                                onClick={() => setSelected(t)}
                                className={`w-full border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selected?._id === t._id ? 'bg-muted' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="truncate text-sm text-foreground">{t.subject}</p>
                                    <span className="inline-flex flex-none items-center gap-1.5 text-[12px] text-muted-foreground"><span aria-hidden className={`size-1.5 rounded-full ${pill(t.status).dot}`} />{pill(t.status).label}</span>
                                </div>
                                <p className="mt-1 truncate text-[12px] text-muted-foreground">{t.userId?.name || t.userId?.businessName || 'User'} · {t.userModel} · {ago(t.updatedAt)} · {(t.messages || []).length} messages</p>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Conversation */}
                <section className={`${panel} min-h-[560px] lg:col-span-3 ${selected ? 'flex' : 'hidden lg:flex'}`}>
                    {!selected ? (
                        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                            <p className="text-sm text-foreground">Select a ticket</p>
                            <p className="mt-1 text-[13px] text-muted-foreground">Open a request to read the conversation and reply.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <button type="button" onClick={() => setSelected(null)} className={`${ICON_BUTTON} lg:hidden`} aria-label="Back to tickets"><ChevronLeft size={16} /></button>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-[15px] font-medium text-foreground">{selected.subject}</h3>
                                        <p className="truncate text-[13px] text-muted-foreground">{selected.userId?.name || selected.userId?.businessName} · {selected.userModel} · opened {ago(selected.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {statusSaving && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                                    <select value={selected.status} onChange={(e) => updateStatus(e.target.value)} disabled={statusSaving} className={`${FIELD} h-9 sm:w-40`} aria-label="Ticket status">
                                        {(Object.keys(STATUS) as Status[]).map((st) => <option key={st} value={st}>{STATUS[st].label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-5">
                                {(selected.messages || []).map((m: any, i: number) => {
                                    const mine = m.senderRole === 'admin' || m.senderRole === 'support';
                                    return (
                                        <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card text-foreground'}`}>
                                                <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                                                {m.attachments?.map((file: any) => (
                                                    <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mt-2 block">
                                                        <img src={file.url} alt={file.name || 'Attachment'} className="max-h-48 rounded-lg bg-black/10 object-contain" />
                                                    </a>
                                                ))}
                                                <p className="mt-1 text-[11px] opacity-60">{new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={threadEnd} />
                            </div>

                            <div className="space-y-2 border-t p-4">
                                {attachment && (
                                    <span className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-1 text-[12px] text-foreground">
                                        <Paperclip size={12} /> {attachment.name}
                                        <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={12} /></button>
                                    </span>
                                )}
                                <div className="flex items-end gap-2">
                                    <textarea
                                        value={reply}
                                        onChange={(e) => setReply(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                                        rows={1}
                                        placeholder="Reply… (Enter to send, Shift+Enter for a new line)"
                                        className={`${FIELD} h-auto min-h-10 resize-none py-2.5`}
                                    />
                                    <label className={`${ICON_BUTTON} size-10 cursor-pointer`} title="Attach image">
                                        <Paperclip className="h-4 w-4" />
                                        <input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={sendReply}
                                        disabled={saving || (!reply.trim() && !attachment)}
                                        className={`${BUTTON} w-10 px-0`}
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
