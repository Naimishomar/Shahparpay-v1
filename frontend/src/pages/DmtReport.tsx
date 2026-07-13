import { FileText } from "lucide-react"

const DmtReport = () => {
    return (
        <div className="flex-1 w-full flex flex-col p-6 animate-in fade-in duration-500 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden">
            <div className="flex flex-col gap-6 h-full">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">DMT Reports</h1>
                        <p className="text-sm text-muted-foreground">View your Domestic Money Transfer history</p>
                    </div>
                </div>
                
                <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col items-center justify-center">
                    <p className="text-muted-foreground">DMT Reports coming soon.</p>
                </div>
            </div>
        </div>
    )
}

export default DmtReport;
