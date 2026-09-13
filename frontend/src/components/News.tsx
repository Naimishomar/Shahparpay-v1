import MarqueePkg from "react-fast-marquee";
import { useTheme } from "next-themes";
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import axios from 'axios';
 
// Handle CommonJS interop issue with Vite
const Marquee: any = (MarqueePkg as any).default ? (MarqueePkg as any).default : MarqueePkg;

const News = ()=>{
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;
    const { token } = useAuth();
    const [updates, setUpdates] = useState<any[]>([]);
    useEffect(() => {
        if (!token) return;
        const load = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/notifications/ticker`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.success) setUpdates(res.data.data || []);
            } catch { /* Keep the ticker usable if announcements are unavailable. */ }
        };
        load();
        const timer = window.setInterval(load, 60000);
        return () => window.clearInterval(timer);
    }, [token]);
    
    // Background colors corresponding to our light and dark theme background CSS variables
    const gradientColor = currentTheme === "dark" ? "#111111" : "#EAEAEA";

    return(
        <div className="w-full bg-primary/5 border-y border-primary/10 my-2 py-2 flex items-center shadow-inner overflow-hidden">
            <div className="px-4 border-r border-primary/20 z-10 bg-background relative flex items-center whitespace-nowrap">
                <span className="font-bold text-xs uppercase tracking-wider text-primary">Latest Updates</span>
            </div>
            <Marquee speed={50} gradient={true} gradientColor={gradientColor} gradientWidth={150} className="text-sm font-medium text-foreground">
                {(updates.length ? updates : [
                    { message: 'System maintenance is scheduled for Sunday at 2:00 AM IST.' },
                    { message: 'New BBPS billers have been added to the platform.' },
                    { message: 'Always verify the beneficiary account details before proceeding with DMT.' },
                ]).map((update, index) => <span key={update._id || index} className="mx-8 text-muted-foreground"><span className="text-primary font-bold mr-2">•</span>{update.title ? `${update.title}: ` : ''}{update.message}</span>)}
            </Marquee> 
        </div>
    )
}

export default News;
