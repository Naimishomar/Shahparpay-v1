import { useEffect, useState, type FormEvent } from 'react';
import { Headset, MessageCircle, Send, X, Paperclip } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const statusStyle: Record<string, string> = { OPEN: 'text-amber-500 bg-amber-500/10', IN_PROGRESS: 'text-blue-500 bg-blue-500/10', RESOLVED: 'text-emerald-500 bg-emerald-500/10', CLOSED: 'text-muted-foreground bg-muted' };

const SupportWidget = () => {
    const { token, user } = useAuth();
    const [open, setOpen] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [selected, setSelected] = useState<any>(null);
    const [showNew, setShowNew] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [reply, setReply] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/support`;
    const headers = { headers: { Authorization: `Bearer ${token}` } };

    const load = async () => { if (!token || user?.role === 'admin') return; try { const res = await axios.get(api, headers); if (res.data.success) setTickets(res.data.data || []); } catch { /* optional support UI */ } };
    useEffect(() => { load(); }, [token, user?.role]);

    const create = async (event: FormEvent) => {
        event.preventDefault();
        if (!subject.trim() || !message.trim()) return toast.error('Enter the issue subject and message');
        setSaving(true);
        try { const form = new FormData(); form.append('subject', subject); form.append('description', message); if (attachment) form.append('attachment', attachment); const res = await axios.post(api, form, headers); if (res.data.success) { toast.success('Support ticket created'); setSubject(''); setMessage(''); setAttachment(null); setShowNew(false); await load(); } }
        catch (error: any) { toast.error(error.response?.data?.message || 'Could not create support ticket'); }
        finally { setSaving(false); }
    };
    const sendReply = async () => { if (!selected || (!reply.trim() && !attachment)) return; setSaving(true); try { const form = new FormData(); form.append('message', reply); if (attachment) form.append('attachment', attachment); const res = await axios.post(`${api}/${selected._id}/messages`, form, headers); if (res.data.success) { setSelected(res.data.data); setReply(''); setAttachment(null); await load(); } } catch (error: any) { toast.error(error.response?.data?.message || 'Could not send message'); } finally { setSaving(false); } };
    if (!token || user?.role === 'admin') return null;

    return <>
        <button onClick={() => { setOpen(true); load(); }} aria-label="Contact support" className="fixed bottom-8 right-8 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_rgba(99,102,241,0.45)] flex items-center justify-center hover:scale-105 transition-transform"><Headset className="w-6 h-6" /></button>
        {open && <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-card border border-border w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-primary/5"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-primary/10 text-primary"><MessageCircle className="w-5 h-5" /></div><div><h2 className="font-bold text-foreground">Customer Support</h2><p className="text-xs text-muted-foreground">Tell us what you need help with</p></div></div><button onClick={() => { setOpen(false); setSelected(null); }} className="text-muted-foreground hover:text-foreground"><X /></button></div>
                <div className="flex-1 overflow-y-auto p-5">
                    {selected ? <div className="space-y-4"><button onClick={() => setSelected(null)} className="text-sm text-primary hover:underline">← Back to my tickets</button><div><h3 className="text-xl font-bold">{selected.subject}</h3><span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-semibold ${statusStyle[selected.status] || statusStyle.OPEN}`}>{selected.status.replace('_', ' ')}</span></div><div className="space-y-3">{(selected.messages?.length ? selected.messages : [{ senderRole: 'user', message: selected.description, createdAt: selected.createdAt }]).map((item: any, index: number) => <div key={index} className={`flex ${item.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${item.senderRole === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}><p className="text-sm whitespace-pre-wrap">{item.message}</p>{item.attachments?.map((file: any) => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="block mt-2"><img src={file.url} alt={file.name || 'Support attachment'} className="max-h-40 rounded-lg object-contain bg-black/10" /></a>)}<p className="text-[10px] opacity-70 mt-1">{new Date(item.createdAt).toLocaleString('en-IN')}</p></div></div>)}</div>{!['RESOLVED', 'CLOSED'].includes(selected.status) && <div className="space-y-2 pt-2"><div className="flex gap-2"><input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Add a message..." className="flex-1 p-3 rounded-xl bg-background border border-border outline-none focus:border-primary" /><label className="p-3 rounded-xl bg-muted cursor-pointer"><Paperclip className="w-4 h-4" /><input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" /></label><button onClick={sendReply} disabled={saving || (!reply.trim() && !attachment)} className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><Send className="w-4 h-4" /></button></div>{attachment && <p className="text-xs text-muted-foreground">Attached: {attachment.name}</p>}</div>}</div> : showNew ? <form onSubmit={create} className="space-y-4"><button type="button" onClick={() => setShowNew(false)} className="text-sm text-primary hover:underline">← Back to my tickets</button><h3 className="text-xl font-bold">Start a support request</h3><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="What do you need help with?" className="w-full p-3 rounded-xl bg-background border border-border outline-none focus:border-primary" /><textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={6} placeholder="Describe the issue, transaction ID, or error message..." className="w-full p-3 rounded-xl bg-background border border-border outline-none focus:border-primary resize-y" /><label className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-border cursor-pointer text-sm text-muted-foreground"><Paperclip className="w-4 h-4" />{attachment ? attachment.name : 'Attach a photo (max 5 MB)'}<input type="file" accept="image/*" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="hidden" /></label><button disabled={saving} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50">{saving ? 'Sending...' : 'Send to Customer Support'}</button></form> : <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">How can we help?</h3><p className="text-sm text-muted-foreground">Track every question and response here.</p></div><button onClick={() => setShowNew(true)} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold">New Request</button></div>{tickets.length === 0 ? <div className="py-12 text-center"><MessageCircle className="w-10 h-10 mx-auto text-primary/60 mb-3" /><p className="font-medium">No support requests yet</p><p className="text-sm text-muted-foreground mt-1">Open a request whenever you need help.</p></div> : tickets.map((ticket) => <button key={ticket._id} onClick={() => setSelected(ticket)} className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="font-semibold truncate">{ticket.subject}</h4><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p></div><span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold ${statusStyle[ticket.status] || statusStyle.OPEN}`}>{ticket.status.replace('_', ' ')}</span></div><p className="text-[11px] text-muted-foreground mt-3">Updated {new Date(ticket.updatedAt).toLocaleString('en-IN')}</p></button>)}</div>}
                </div>
            </div>
        </div>}
    </>;
};

export default SupportWidget;
