import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Bell, Megaphone, Send } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const AdminNotifications = () => {
    const { token } = useAuth();
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/notifications`;
    const [items, setItems] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: '', message: '', kind: 'info', showInTicker: true, expiresAt: '' });

    const load = async () => {
        const res = await axios.get(api, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setItems(res.data.data || []);
    };
    useEffect(() => { if (token) load().catch(() => undefined); }, [token]);

    const publish = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.title.trim() || !form.message.trim()) return toast.error('Enter a title and message');
        setSaving(true);
        try {
            const res = await axios.post(api, form, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { toast.success('Notification published'); setForm({ title: '', message: '', kind: 'info', showInTicker: true, expiresAt: '' }); load(); }
        } catch (error: any) { toast.error(error.response?.data?.message || 'Could not publish notification'); }
        finally { setSaving(false); }
    };

    const archive = async (id: string) => {
        try { await axios.delete(`${api}/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setItems((rows) => rows.filter((row) => row._id !== id)); toast.success('Notification archived'); }
        catch { toast.error('Could not archive notification'); }
    };

    return <div className="space-y-6 animate-in fade-in duration-500">
        <div><h2 className="text-3xl font-bold mb-2 flex items-center gap-3"><Bell className="text-primary" /> Notifications & Latest Updates</h2><p className="text-muted-foreground">Publish announcements for all retailers and distributors.</p></div>
        <form onSubmit={publish} className="glass-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold"><Megaphone className="w-5 h-5 text-primary" /> Create announcement</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Title" className="w-full p-3 rounded-xl bg-background border border-border outline-none focus:border-primary" /><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full p-3 rounded-xl bg-background border border-border outline-none focus:border-primary"><option value="info">Information</option><option value="success">Success</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></div>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={1000} rows={4} placeholder="Write the announcement..." className="w-full p-3 rounded-xl bg-background border border-border outline-none focus:border-primary resize-y" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.showInTicker} onChange={(e) => setForm({ ...form, showInTicker: e.target.checked })} className="accent-primary" /> Show in Latest Updates ticker</label><label className="flex items-center gap-2 text-sm">Expires <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="p-2 rounded-lg bg-background border border-border" /></label><button disabled={saving} className="sm:ml-auto px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">{saving ? 'Publishing...' : <><Send className="w-4 h-4" /> Publish</>}</button></div>
        </form>
        <div className="glass-card rounded-2xl border border-border overflow-hidden"><div className="p-5 border-b border-border font-bold">Active announcements</div>{items.length === 0 ? <p className="p-6 text-center text-muted-foreground">No active announcements.</p> : items.map((item) => <div key={item._id} className="p-5 border-b border-border/60 flex items-start gap-4"><div className="p-2 rounded-lg bg-primary/10 text-primary"><Bell className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex flex-wrap gap-2 items-center"><h3 className="font-bold">{item.title}</h3>{item.showInTicker && <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Ticker</span>}</div><p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{item.message}</p><p className="text-xs text-muted-foreground mt-2">{new Date(item.createdAt).toLocaleString('en-IN')}</p></div><button onClick={() => archive(item._id)} className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10" title="Archive"><Archive className="w-4 h-4" /></button></div>)}</div>
    </div>;
};

export default AdminNotifications;
