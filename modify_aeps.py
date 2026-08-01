import re

with open('frontend/src/pages/AEPS.tsx', 'r') as f:
    content = f.read()

# We need to extract the parts and reassemble.
# 1. Inputs Row
inputs_start = content.find('{/* Inputs Row */}')
popular_banks_start = content.find('{/* Popular Banks Selection */}')
device_sel_start = content.find('{/* Device Selection and Reset */}')
consent_start = content.find('{/* Consent */}')
recent_txns_start = content.find('{/* Recent Transactions Section */}')

inputs_content = content[inputs_start:popular_banks_start].strip()
popular_banks_content = content[popular_banks_start:device_sel_start].strip()
device_sel_content = content[device_sel_start:consent_start].strip()

# Consent, Scan, Buttons are between consent_start and recent_txns_start
right_side_original = content[consent_start:recent_txns_start].strip()

# Now we construct the new layout
# We want:
# <div className="flex flex-col lg:flex-row justify-between gap-6 w-full">
#     <div className="flex-1">
#         [Inputs Row with flex-1 added]
#     </div>
#     <div className="flex flex-col items-center justify-center gap-6 bg-primary/5 p-5 border-r-4 border-primary rounded-lg w-full lg:w-[400px]">
#         [Consent, modified]
#         [Scan Button, modified]
#         [Clear/Submit, modified]
#     </div>
# </div>
# [Popular Banks Selection]
# [Device Selection and Reset]

# Modify the consent, scan, buttons for the right side column
right_side_modified = """
                        {/* Right Column: Scan & Action Area */}
                        <div className="flex flex-col items-center justify-center gap-6 bg-primary/5 p-5 border-r-4 border-primary rounded-lg w-full lg:w-[400px]">
                            {/* Consent */}
                            <label className="flex items-start gap-3 cursor-pointer group w-full bg-background p-4 rounded-xl border border-border">
                                <input 
                                    type="checkbox" 
                                    checked={consent}
                                    onChange={(e) => setConsent(e.target.checked)}
                                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary mt-1 cursor-pointer shrink-0" 
                                />
                                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-tight">
                                    I hereby provide my consent to CSP to use my Aadhaar number/ VID to complete AEPS transaction authorisation.
                                </span>
                            </label>

                            {/* Scan Button */}
                            <button 
                                onClick={captureFingerprint} 
                                disabled={isScanning || !!pidData}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all w-full
                                    ${pidData 
                                        ? 'border-green-500 bg-green-50 dark:bg-green-500/10' 
                                        : 'border-dashed border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer bg-background'}`}
                            >
                                <div className="relative">
                                    <Fingerprint className={`w-12 h-12 ${pidData ? 'text-green-500' : 'text-primary'} ${isScanning ? 'animate-pulse' : ''}`} />
                                    {isScanning && (
                                        <div className="absolute inset-0 bg-primary/20 animate-ping rounded-full"></div>
                                    )}
                                </div>
                                <div className="text-center">
                                    <h3 className={`font-semibold ${pidData ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                                        {isScanning ? 'Scanning...' : (pidData ? 'Fingerprint Captured' : 'Scan Fingerprint')}
                                    </h3>
                                    {!pidData && !isScanning && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Click to capture customer biometric
                                        </p>
                                    )}
                                </div>
                            </button>

                            {/* Clear/Submit Buttons */}
                            <div className="flex gap-4 w-full">
                                <button onClick={() => {
                                    setAadhaarNo('');
                                    setMobileNo('');
                                    setAmount('');
                                    setPidData(null);
                                    setBankName('');
                                }} className="flex-1 py-3 rounded-lg border border-border hover:bg-muted font-medium transition-colors">
                                    Clear
                                </button>
                                <button onClick={handleSubmit} disabled={loading || !pidData} className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] transition-all duration-300 disabled:opacity-50">
                                    {loading ? <RefreshCcw className="animate-spin mx-auto" size={20} /> : "Submit"}
                                </button>
                            </div>
                        </div>
"""

inputs_content = inputs_content.replace('className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg"', 'className="flex flex-col gap-4 bg-primary/5 p-5 border-l-4 border-primary rounded-lg flex-1"')

new_layout = f"""
                    <div className="flex flex-col xl:flex-row justify-between gap-6 w-full">
{inputs_content}
{right_side_modified}
                    </div>

                    {popular_banks_content}

                    {device_sel_content}
"""

content = content[:inputs_start] + new_layout + '\n                    {/* Recent Transactions Section */}' + content[recent_txns_start + len('{/* Recent Transactions Section */}'):]

with open('frontend/src/pages/AEPS.tsx', 'w') as f:
    f.write(content)

print("Modification done!")
