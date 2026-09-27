import { useEffect, useState, type FormEvent } from 'react';
import { Headset, MessageCircle, Paperclip, Send, ScanFace, Fingerprint, ArrowLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const statusStyle: Record<string, string> = {
    OPEN: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20',
    IN_PROGRESS: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    CLOSED: 'bg-zinc-500/10 text-muted-foreground ring-zinc-500/20',
};

// Same black (light) / silver (dark) language as the dashboard.
const ACTIVE_BUTTON = 'bg-zinc-900 text-white shadow-md shadow-black/20 dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900 dark:shadow-white/10';
const SILVER_TILE = 'bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30';
const INPUT = 'w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition focus:border-zinc-400 focus:ring-4 focus:ring-zinc-400/15 dark:focus:border-zinc-500';

const Support = () => {
    const { token, user } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/support`;
    const headers = { headers: { Authorization: `Bearer ${token}` } };
    const [tickets, setTickets] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [newRequest, setNewRequest] = useState(false);
    const [form, setForm] = useState({ subject: '', description: '', recipient: user?.role === 'retailer' ? 'distributor' : 'admin' });
    const [reply, setReply] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const load = async () => { try { const res = await axios.get(api, headers); if (res.data.success) setTickets(res.data.data || []); } catch { toast.error('Could not load support requests'); } };
    useEffect(() => { if (token) load(); }, [token]);
    const create = async (event: FormEvent) => { event.preventDefault(); if (!form.subject.trim() || (!form.description.trim() && !attachment)) return toast.error('Enter a message or attach a photo'); setSaving(true); try { const data = new FormData(); data.append('subject', form.subject); data.append('description', form.description); data.append('recipient', form.recipient); if (attachment) data.append('attachment', attachment); const res = await axios.post(api, data, headers); if (res.data.success) { toast.success('Support request created'); setForm({ subject: '', description: '', recipient: user?.role === 'retailer' ? 'distributor' : 'admin' }); setAttachment(null); setNewRequest(false); load(); } } catch (error: any) { toast.error(error.response?.data?.message || 'Could not create request'); } finally { setSaving(false); } };
    const sendReply = async () => { if (!selected || (!reply.trim() && !attachment)) return; setSaving(true); try { const data = new FormData(); data.append('message', reply); if (attachment) data.append('attachment', attachment); const res = await axios.post(`${api}/${selected._id}/messages`, data, headers); if (res.data.success) { setSelected(res.data.data); setReply(''); setAttachment(null); load(); } } catch (error: any) { toast.error(error.response?.data?.message || 'Could not send message'); } finally { setSaving(false); } };
    const updateStatus = async (next: string) => { if (!selected || !['retailer', 'distributor'].includes(user?.role || '')) return; try { const res = await axios.patch(`${api}/${selected._id}`, { status: next }, headers); if (res.data.success) { setSelected(res.data.data); load(); } } catch (error: any) { toast.error(error.response?.data?.message || 'Could not update status'); } };

    const isRetailer = user?.role !== 'admin' && user?.role !== 'distributor';
    const statusPill = (status: string) => (
        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 h-fit ${statusStyle[status] || statusStyle.OPEN}`}>
            {status.replace('_', ' ')}
        </span>
    );
    const counts = ['OPEN', 'IN_PROGRESS', 'RESOLVED'].map((st) => ({ st, n: tickets.filter((t) => t.status === st).length }));

    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
                <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-zinc-300/60 dark:bg-zinc-500/20 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-200/70 dark:bg-slate-400/10 blur-3xl" />
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-black/10 dark:text-white/10 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                        <div className={`rounded-2xl p-3 ${SILVER_TILE}`}>
                            <Headset className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Support Center</h1>
                            <p className="text-sm text-muted-foreground">Raise an issue, share screenshots, and track resolution.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        {isRetailer && (
                            <>
                                <Link to="/aeps/pipes" className="flex items-center justify-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5 text-sm font-semibold hover:bg-background">
                                    <ScanFace className="w-4 h-4" /> AEPS Pipe Status
                                </Link>
                                <Link to="/biometric-support" className="flex items-center justify-center gap-2 rounded-xl border bg-background/70 backdrop-blur px-4 py-2.5 text-sm font-semibold hover:bg-background">
                                    <Fingerprint className="w-4 h-4" /> Biometric Support
                                </Link>
                            </>
                        )}
                        <button onClick={() => { setSelected(null); setNewRequest(true); }} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold ${ACTIVE_BUTTON}`}>
                            <MessageCircle className="w-4 h-4" /> New Request
                        </button>
                    </div>
                </div>
            </section>

            {newRequest ? (
                <form onSubmit={create} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-3 border-b pb-4">
                        <div className={`rounded-xl p-2.5 ${SILVER_TILE}`}>
                            <MessageCircle className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-semibold">Create support request</h2>
                    </div>
                    {user?.role === 'retailer' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Contact</label>
                            <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background/60 p-1 sm:w-96">
                                {[['distributor', 'My Distributor'], ['admin', 'ShahparPay Admin']].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setForm({ ...form, recipient: value })}
                                        className={`rounded-lg py-2 text-sm font-semibold transition-all ${form.recipient === value ? ACTIVE_BUTTON : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Subject</label>
                        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Issue subject" maxLength={150} className={INPUT} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Details</label>
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your issue, transaction ID, or error..." rows={6} maxLength={2000} className={`${INPUT} resize-y`} />
                        <p className="text-right text-[11px] text-muted-foreground tabular-nums">{form.description.length}/2000</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed bg-background/50 p-3.5 text-sm text-muted-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                        <Paperclip className="w-4 h-4" />
                        {attachment ? attachment.name : 'Attach issue photo (max 5 MB)'}
                        <input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" />
                    </label>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setNewRequest(false)} className="rounded-xl border px-5 py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancel</button>
                        <button disabled={saving} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold disabled:opacity-50 ${ACTIVE_BUTTON}`}>
                            <Send className="h-4 w-4" /> {saving ? 'Sending...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            ) : selected ? (
                <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="flex flex-wrap justify-between gap-3 border-b p-5">
                        <div className="min-w-0">
                            <button onClick={() => setSelected(null)} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                                <ArrowLeft className="h-4 w-4" /> All requests
                            </button>
                            <h2 className="text-lg font-semibold">{selected.subject}</h2>
                            <div className="mt-2">{statusPill(selected.status)}</div>
                        </div>
                        {user?.role === 'distributor' && (
                            <select value={selected.status} onChange={(e) => updateStatus(e.target.value)} className={`${INPUT} h-fit w-auto`}>
                                <option value="OPEN">Open</option>
                                <option value="IN_PROGRESS">In progress</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="CLOSED">Closed</option>
                            </select>
                        )}
                    </div>
                    <div className="min-h-[300px] space-y-3 bg-black/[0.015] p-5 dark:bg-white/[0.015]">
                        {(selected.messages || []).map((item: any, index: number) => (
                            <div key={index} className={`flex ${item.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${item.senderRole === 'user' ? `${ACTIVE_BUTTON} rounded-br-md` : 'border bg-card text-foreground rounded-bl-md'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                                    {item.attachments?.map((file: any) => (
                                        <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="block mt-2">
                                            <img src={file.url} alt={file.name || 'Support attachment'} className="max-h-52 rounded-lg" />
                                        </a>
                                    ))}
                                    <p className="text-[10px] opacity-60 mt-1">{new Date(item.createdAt).toLocaleString('en-IN')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {!['RESOLVED', 'CLOSED'].includes(selected.status) && (
                        <div className="space-y-2 border-t p-4">
                            <div className="flex gap-2">
                                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." className={`${INPUT} flex-1`} />
                                <label className="flex cursor-pointer items-center rounded-xl border px-3 hover:bg-black/5 dark:hover:bg-white/5" title="Attach photo">
                                    <Paperclip className="w-4 h-4" />
                                    <input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" />
                                </label>
                                <button onClick={sendReply} disabled={saving || (!reply.trim() && !attachment)} className={`rounded-xl px-4 disabled:opacity-50 disabled:shadow-none ${ACTIVE_BUTTON}`} title="Send">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            {attachment && <p className="text-xs text-muted-foreground">Attached: {attachment.name}</p>}
                        </div>
                    )}
                </section>
            ) : (
                <section className="rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">My requests</h2>
                        <div className="flex flex-wrap gap-2">
                            {counts.map(({ st, n }) => (
                                <span key={st} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusStyle[st]}`}>
                                    {st.replace('_', ' ')} · {n}
                                </span>
                            ))}
                        </div>
                    </div>
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <div className={`mb-3 rounded-2xl p-4 ${SILVER_TILE}`}>
                                <Headset className="h-7 w-7" />
                            </div>
                            <p className="text-sm">No support requests yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {tickets.map((ticket) => (
                                <button key={ticket._id} onClick={() => setSelected(ticket)} className="group rounded-2xl border bg-background/50 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-400 dark:hover:border-zinc-600">
                                    <div className="flex justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold">{ticket.subject}</h3>
                                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>
                                        </div>
                                        {statusPill(ticket.status)}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Updated {new Date(ticket.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default Support;
