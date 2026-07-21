import MarqueePkg from "react-fast-marquee";
import { useTheme } from "next-themes";
 
// Handle CommonJS interop issue with Vite
const Marquee: any = (MarqueePkg as any).default ? (MarqueePkg as any).default : MarqueePkg;

const News = ()=>{
    const { theme, systemTheme } = useTheme();
    const currentTheme = theme === "system" ? systemTheme : theme;
    
    // Background colors corresponding to our light and dark theme background CSS variables
    const gradientColor = currentTheme === "dark" ? "#EAEAEA" : "#111111";

    return(
        <div className="w-full bg-primary/5 border-y border-primary/10 my-2 py-2 flex items-center shadow-inner overflow-hidden">
            <div className="px-4 border-r border-primary/20 z-10 bg-background relative flex items-center whitespace-nowrap">
                <span className="font-bold text-xs uppercase tracking-wider text-primary">Latest Updates</span>
            </div>
            <Marquee speed={50} gradient={true} gradientColor={gradientColor} gradientWidth={150} className="text-sm font-medium text-foreground">
                <span className="mx-8 text-muted-foreground"><span className="text-primary font-bold mr-2">•</span>System maintenance is scheduled for Sunday at 2:00 AM IST.</span>
                <span className="mx-8 text-muted-foreground"><span className="text-primary font-bold mr-2">•</span>New BBPS billers have been added to the platform.</span>
                <span className="mx-8 text-muted-foreground"><span className="text-primary font-bold mr-2">•</span>Always verify the beneficiary account details before proceeding with DMT.</span>
            </Marquee> 
        </div>
    )
}

export default News;