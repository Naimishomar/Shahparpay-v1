import MarqueePkg from "react-fast-marquee";
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useVisiblePolling } from '../hooks/use-visible-polling';
import axios from 'axios';
 
// Handle CommonJS interop issue with Vite
const Marquee: any = (MarqueePkg as any).default ? (MarqueePkg as any).default : MarqueePkg;

const News = ()=>{
    const { token } = useAuth();
    const [updates, setUpdates] = useState<any[]>([]);
    useVisiblePolling(async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/notifications/ticker`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) setUpdates(res.data.data || []);
        } catch { /* Keep the ticker usable if announcements are unavailable. */ }
    }, 5 * 60000, Boolean(token));
    
    // The edges fade through an alpha mask rather than the marquee's own
    // gradient: that one paints a solid colour, which never matches the tinted
    // bar and showed as a grey or black box over the scrolling text.
    const fade = 'linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent)';

    return(
        <div className="w-full bg-primary/5 border-y border-primary/10 my-2 py-2 flex items-center shadow-inner overflow-hidden">
            <div className="px-4 border-r border-primary/20 flex shrink-0 items-center whitespace-nowrap">
                <span className="font-bold text-xs uppercase tracking-wider text-primary">Latest Updates</span>
            </div>
            <div className="min-w-0 flex-1" style={{ maskImage: fade, WebkitMaskImage: fade }}>
            <Marquee speed={50} gradient={false} className="text-sm font-medium text-foreground">
                {(updates.length ? updates : [
                    { message: 'System maintenance is scheduled for Sunday at 2:00 AM IST.' },
                    { message: 'New BBPS billers have been added to the platform.' },
                    { message: 'Always verify the beneficiary account details before proceeding with DMT.' },
                ]).map((update, index) => <span key={update._id || index} className="mx-8 text-muted-foreground"><span className="text-primary font-bold mr-2">•</span>{update.title ? `${update.title}: ` : ''}{update.message}</span>)}
            </Marquee>
            </div>
        </div>
    )
}

export default News;
