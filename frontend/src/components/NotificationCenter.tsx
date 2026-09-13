import { useEffect, useRef, useState } from 'react';
import { Bell, Check, Info, TriangleAlert, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const NotificationCenter = () => {
    const { token } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const api = `${import.meta.env.VITE_BACKEND_URL}/api/notifications`;

    const load = async () => {
        if (!token) return;
        try {
            const res = await axios.get(api, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) { setItems(res.data.data || []); setUnread(res.data.unreadCount || 0); }
        } catch { /* Header notifications must never block the app. */ }
    };

    useEffect(() => {
        load();
        const timer = window.setInterval(load, 30000);
        return () => window.clearInterval(timer);
    }, [token]);

    useEffect(() => {
        const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const markRead = async (item: any) => {
        if (!item.isRead) {
            await axios.post(`${api}/${item._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
            setItems((current) => current.map((row) => row._id === item._id ? { ...row, isRead: true } : row));
            setUnread((count) => Math.max(0, count - 1));
        }
    };

    const Icon = (kind: string) => kind === 'urgent' || kind === 'warning' ? TriangleAlert : Info;

    return <div className="relative" ref={ref}>
        <button onClick={() => { setOpen((value) => !value); if (!open) load(); }} aria-label="Notifications" className="relative p-2 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <Bell className="h-5 w-5 text-foreground" />
            {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>}
        </button>
        {open && <div className="absolute right-0 top-12 z-[70] w-[min(92vw,380px)] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border"><div><h3 className="font-bold text-foreground">Notifications</h3><p className="text-xs text-muted-foreground">Latest platform announcements</p></div><button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
            <div className="max-h-[min(70vh,420px)] overflow-y-auto">
                {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p> : items.map((item) => { const ItemIcon = Icon(item.kind); return <button key={item._id} onClick={() => markRead(item)} className={`w-full text-left p-4 border-b border-border/60 hover:bg-muted/40 transition-colors ${!item.isRead ? 'bg-primary/5' : ''}`}><div className="flex gap-3"><div className={`mt-0.5 p-2 rounded-lg ${item.kind === 'urgent' || item.kind === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}><ItemIcon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="font-semibold text-sm text-foreground">{item.title}</p>{item.isRead ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />}</div><p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{item.message}</p><p className="text-[11px] text-muted-foreground mt-2">{new Date(item.createdAt).toLocaleString('en-IN')}</p></div></div></button>; })}
            </div>
        </div>}
    </div>;
};

export default NotificationCenter;
