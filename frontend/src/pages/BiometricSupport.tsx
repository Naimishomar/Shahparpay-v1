import { Fingerprint, Download, ExternalLink, HelpCircle, HardDrive, Smartphone, Monitor, Phone, Mail, CheckCircle2, ShieldCheck } from 'lucide-react';

const BiometricSupport = () => {
    const devices = [
        {
            id: 'mantra',
            name: 'Mantra MFS100',
            description: 'Download the latest RD Service & Driver for Mantra devices.',
            winDriver: 'https://mantratec.com/Download/User',
            winRdService: 'https://mantratec.com/Download/User',
            androidApp: 'https://play.google.com/store/search?q=mantra+rd+service&c=apps&hl=en',
            icon: <Fingerprint className="text-primary w-12 h-12" />
        },
        {
            id: 'morpho',
            name: 'Morpho E3',
            description: 'IDEMIA Morpho RD Service driver for seamless AEPS transactions.',
            winDriver: 'https://rdserviceonline.com/pages/downloads?srsltid=AfmBOooCpC01RfH_ItD4KWDko8Y836XfqT4tmVy_idknPXzwmW4p1eFN',
            winRdService: 'https://rdserviceonline.com/pages/downloads?srsltid=AfmBOooCpC01RfH_ItD4KWDko8Y836XfqT4tmVy_idknPXzwmW4p1eFN',
            androidApp: 'https://play.google.com/store/apps/details?id=com.idemia.l1rdservice&hl=en_IN',
            icon: <HardDrive className="text-blue-500 w-12 h-12" />
        },
        {
            id: 'startek',
            name: 'Startek FM220',
            description: 'ACPL FM220 Registered Device Service and Windows drivers.',
            winDriver: 'https://www.acpl.in.net/RdServiceNew.html',
            winRdService: 'https://www.acpl.in.net/RdServiceNew.html',
            androidApp: 'https://play.google.com/store/apps/details?id=com.acpl.registersdk_l1',
            icon: <Fingerprint className="text-emerald-500 w-12 h-12" />
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full p-2 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Top Header Section */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-glow flex items-center gap-2">
                        <Fingerprint className="text-primary" size={28} />
                        Biometric Support
                    </h1>
                    <p className="text-sm text-muted-foreground hidden md:block">
                        Download RD Services and Drivers for your AEPS devices.
                    </p>
                </div>
                    <button onClick={() => document.getElementById('setup-steps')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-2.5 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-all flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Setup Guide
                </button>
            </div>

            {/* Main Container */}
            <div className="flex flex-col glass-card rounded-2xl relative overflow-hidden group border border-border">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none"></div>
                
                <div className="relative z-10 p-6 md:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {devices.map((device) => (
                            <div key={device.id} className="bg-background/50 border border-border hover:border-primary/50 transition-all rounded-2xl p-6 flex flex-col h-full group/card">
                                <div className="mb-6 flex justify-between items-start">
                                    <div className="p-4 bg-muted/30 rounded-2xl group-hover/card:scale-110 transition-transform duration-300">
                                        {device.icon}
                                    </div>
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-full border border-green-500/20">Active Support</span>
                                </div>
                                
                                <h3 className="text-xl font-bold text-foreground mb-2">{device.name}</h3>
                                <p className="text-sm text-muted-foreground mb-8 flex-1">{device.description}</p>
                                
                                <div className="space-y-3">
                                    <a 
                                        href={device.winRdService}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-primary/10 hover:text-primary rounded-xl text-sm font-medium transition-colors border border-border"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4" /> Windows RD Service
                                        </div>
                                        <Download className="w-4 h-4 opacity-70" />
                                    </a>
                                    <a 
                                        href={device.winDriver}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-primary/10 hover:text-primary rounded-xl text-sm font-medium transition-colors border border-border"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4" /> Windows Driver
                                        </div>
                                        <Download className="w-4 h-4 opacity-70" />
                                    </a>
                                    <a 
                                        href={device.androidApp}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-primary/10 hover:text-primary rounded-xl text-sm font-medium transition-colors border border-border"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Smartphone className="w-4 h-4" /> Android App
                                        </div>
                                        <ExternalLink className="w-4 h-4 opacity-70" />
                                    </a>
                                </div>
                                <div className="mt-6 pt-5 border-t border-border" id={`${device.id}-steps`}>
                                    <h4 className="font-bold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Enable {device.name}</h4>
                                    <ol className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Uninstall old RD Service and old scanner drivers from Windows, then restart the computer.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Open the official download link above and install the Windows driver as Administrator.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Install the {device.name} RD Service, accept the certificate/firewall prompts, and restart again.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Connect the scanner directly to a working USB port; avoid hubs and confirm its indicator light turns on.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">5.</span> On Android, install the Android RD app above, allow nearby-device/USB permissions, and keep it running in the background.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">6.</span> Open the RD Service status page and confirm the device is detected and registered.</li>
                                        <li className="flex gap-2"><span className="font-bold text-primary">7.</span> Return to ShahparPay → AEPS/Merchant eKYC, allow browser permissions, select this device, and click Capture.</li>
                                    </ol>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div id="setup-steps" className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl">
                        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2"><CheckCircle2 className="text-primary" /> Final checklist before AEPS/eKYC</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                            <p>✓ Only one RD Service should be running for the connected scanner.</p>
                            <p>✓ Device must appear as registered/ready in the RD Service.</p>
                            <p>✓ Windows users should check ports 11100–11120 are not blocked.</p>
                            <p>✓ Temporarily allow the RD Service through Windows Firewall.</p>
                            <p>✓ Use Chrome/Edge and allow localhost, USB, and camera/device permissions.</p>
                            <p>✓ On Android, keep the RD app open and reconnect the USB/OTG cable.</p>
                            <p>✓ If capture fails, unplug the scanner, restart RD Service, and retry once.</p>
                            <p>✓ Do not share Aadhaar, fingerprints, or MPIN in screenshots sent to support.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div className="p-6 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl flex items-start gap-4">
                            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500 mt-0.5">
                                <HelpCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground mb-1">Troubleshooting Note</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Please ensure that you have uninstalled any previous versions of the RD Service before installing the new one. 
                                    After installation, clear your browser cache and restart your system. If the device is still not captured, unplug it and plug it back into a different USB port.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col gap-4">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-primary/20 rounded-lg text-primary mt-0.5">
                                    <Phone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground mb-1">Need Technical Support?</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        If you are facing issues with your biometric device setup or driver installation, our support team is available to help you.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-3 mt-2 pt-4 border-t border-border">
                                <a href="tel:+919876543210" className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors">
                                    <div className="p-2 bg-muted/50 rounded-lg"><Phone className="w-4 h-4 text-primary" /></div>
                                    +91 98765 43210
                                </a>
                                <a href="mailto:support@shahparpay.com" className="flex items-center gap-3 text-sm font-medium text-foreground hover:text-primary transition-colors">
                                    <div className="p-2 bg-muted/50 rounded-lg"><Mail className="w-4 h-4 text-primary" /></div>
                                    support@shahparpay.com
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BiometricSupport;
