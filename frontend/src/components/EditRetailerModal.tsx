import React, { useState } from 'react';
import { X, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { INDIAN_STATES } from '../constants';

interface EditRetailerModalProps {
    retailer: any;
    onClose: () => void;
    onUpdated: () => void;
}

const EditRetailerModal: React.FC<EditRetailerModalProps> = ({ retailer, onClose, onUpdated }) => {
    const { token } = useAuth();

    const [formData, setFormData] = useState<any>(() => ({
        prefix: retailer.prefix || 'Mr',
        firstName: retailer.firstName || '',
        lastName: retailer.lastName || '',
        email: retailer.email || '',
        contactNumber: retailer.contactNumber || '',
        dob: retailer.dob || '',
        password: '',
        businessName: retailer.businessName || '',
        businessAddress: retailer.businessAddress || '',
        aadhaarNumber: retailer.aadhaarNumber || '',
        panNumber: retailer.panNumber || '',
        hasGst: retailer.hasGst || false,
        gstNumber: retailer.gstNumber || '',
        city: retailer.address?.city || '',
        landmark: retailer.address?.landmark || '',
        district: retailer.address?.district || '',
        state: retailer.address?.state || '',
        dmtPackage: retailer.dmtPackage || '',
        rechargePackage: retailer.rechargePackage || '',
        aepsPackage: retailer.aepsPackage || '',
        bbpsPackage: retailer.bbpsPackage || '',
        payoutPackage: retailer.payoutPackage || '',
        cmsPackage: retailer.cmsPackage || '',
        ccpayPackage: retailer.ccpayPackage || '',
        payinPackage: retailer.payinPackage || '',
        upiPackage: retailer.upiPackage || '',
        website: retailer.website || '',
        brandName: retailer.brandName || '',
        companyRegisterName: retailer.companyRegisterName || '',
        supportEmail: retailer.supportEmail || '',
        supportMobile: retailer.supportMobile || '',
    }));

    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [aadhaarPicture, setAadhaarPicture] = useState<File | null>(null);
    const [panPicture, setPanPicture] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (['city', 'landmark', 'district', 'state'].includes(key)) return;
            if (key === 'password' && !value) return;
            data.append(key, value as any);
        });
        data.append('address', JSON.stringify({
            city: formData.city,
            landmark: formData.landmark,
            district: formData.district,
            state: formData.state,
        }));

        if (profilePicture) data.append('profilePicture', profilePicture);
        if (aadhaarPicture) data.append('aadhaarPicture', aadhaarPicture);
        if (panPicture) data.append('panPicture', panPicture);

        try {
            const res = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/api/distributor/retailers/${retailer._id}`,
                {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: data,
                }
            );
            const resData = await res.json();
            if (resData.success) {
                toast.success('Retailer details updated successfully!');
                onUpdated();
                onClose();
            } else {
                toast.error(resData.message || 'Failed to update retailer details.');
            }
        } catch (err) {
            toast.error('Failed to update retailer details.');
        } finally {
            setLoading(false);
        }
    };

    const inputCls =
        "w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors";
    const labelCls = "text-sm font-semibold text-muted-foreground";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-background w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-5 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <UserPlus className="text-primary w-6 h-6" />
                        <div>
                            <h2 className="font-bold text-lg text-foreground">Edit Retailer Details</h2>
                            <p className="text-xs text-muted-foreground">{retailer.retailerId} · {retailer.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form id="edit-retailer-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto no-scrollbar space-y-8">
                    {/* Personal Information */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">1. Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className={labelCls}>Prefix</label>
                                <select name="prefix" onChange={handleChange} value={formData.prefix} className={inputCls}>
                                    <option value="Mr">Mr</option>
                                    <option value="Mrs">Mrs</option>
                                    <option value="Miss">Miss</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>First Name</label>
                                <input name="firstName" value={formData.firstName} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Last Name</label>
                                <input name="lastName" value={formData.lastName} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Email</label>
                                <input name="email" type="email" value={formData.email} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Mobile</label>
                                <input name="contactNumber" value={formData.contactNumber} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Date Of Birth</label>
                                <input name="dob" type="date" value={formData.dob} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>New Password (leave blank to keep)</label>
                                <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Leave blank to keep" className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Profile Picture</label>
                                <label className="w-full p-3 rounded-xl bg-background border border-dashed border-border focus:border-primary outline-none transition-colors cursor-pointer block text-muted-foreground text-sm truncate">
                                    {profilePicture ? profilePicture.name : 'Choose new file...'}
                                    <input type="file" onChange={(e) => setProfilePicture(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Business & Identity */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">2. Business & Identity</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className={labelCls}>Business Name</label>
                                <input name="businessName" value={formData.businessName} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Street Address</label>
                                <input name="businessAddress" value={formData.businessAddress} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>City</label>
                                <input name="city" value={formData.city} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>District</label>
                                <input name="district" value={formData.district} onChange={handleChange} required className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>State</label>
                                <select name="state" value={formData.state} onChange={handleChange} required className={inputCls}>
                                    <option value="" disabled>Select State</option>
                                    {INDIAN_STATES.map((state) => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Landmark</label>
                                <input name="landmark" value={formData.landmark} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Aadhaar Number</label>
                                <input name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Aadhaar Picture</label>
                                <label className="w-full p-3 rounded-xl bg-background border border-dashed border-border focus:border-primary outline-none transition-colors cursor-pointer block text-muted-foreground text-sm truncate">
                                    {aadhaarPicture ? aadhaarPicture.name : 'Choose new file...'}
                                    <input type="file" onChange={(e) => setAadhaarPicture(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>PAN Number</label>
                                <input name="panNumber" value={formData.panNumber} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>PAN Picture</label>
                                <label className="w-full p-3 rounded-xl bg-background border border-dashed border-border focus:border-primary outline-none transition-colors cursor-pointer block text-muted-foreground text-sm truncate">
                                    {panPicture ? panPicture.name : 'Choose new file...'}
                                    <input type="file" onChange={(e) => setPanPicture(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                                </label>
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>GST Number</label>
                                <input name="gstNumber" value={formData.gstNumber} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2 flex items-end">
                                <label className="flex items-center gap-4 cursor-pointer text-sm font-semibold text-muted-foreground">
                                    <input
                                        name="hasGst"
                                        type="checkbox"
                                        checked={formData.hasGst}
                                        onChange={(e) => setFormData({ ...formData, hasGst: e.target.checked })}
                                        className="w-4 h-4 accent-primary"
                                    />
                                    Has GST
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Service Packages */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">3. Service Packages</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(
                                ['dmtPackage', 'rechargePackage', 'aepsPackage', 'bbpsPackage', 'payoutPackage',
                                    'cmsPackage', 'ccpayPackage', 'payinPackage', 'upiPackage'] as const
                            ).map((pkg) => (
                                <div className="space-y-2" key={pkg}>
                                    <label className={labelCls}>{pkg.replace('Package', ' Package').replace(/([a-z])([A-Z])/g, '$1 $2')}</label>
                                    <select name={pkg} value={formData[pkg]} onChange={handleChange} className={inputCls}>
                                        <option value="">Choose Commission Package</option>
                                        <option value="Standard">Standard Package</option>
                                        <option value="Premium">Premium Package</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Branding & Support */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 border-b border-border pb-2">4. Branding & Support</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className={labelCls}>Brand Name</label>
                                <input name="brandName" value={formData.brandName} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Company Register Name</label>
                                <input name="companyRegisterName" value={formData.companyRegisterName} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Website</label>
                                <input name="website" value={formData.website} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Support Email</label>
                                <input name="supportEmail" type="email" value={formData.supportEmail} onChange={handleChange} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <label className={labelCls}>Support Mobile</label>
                                <input name="supportMobile" value={formData.supportMobile} onChange={handleChange} className={inputCls} />
                            </div>
                        </div>
                    </div>
                </form>

                <div className="border-t border-border p-4 bg-muted/20 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-retailer-form"
                        disabled={loading}
                        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold shadow-md flex items-center gap-2 disabled:opacity-50 transition-all hover:bg-primary/90"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus size={18} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditRetailerModal;