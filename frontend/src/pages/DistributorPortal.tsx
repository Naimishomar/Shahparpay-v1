import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import {
    UserPlus,
    FileText,
    CheckCircle,
    XCircle,
    Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import MerchantKycModal from '../components/MerchantKycModal';
import EditRetailerModal from '../components/EditRetailerModal';
import NetworkDashboard, { type DirectoryPreset } from '../components/distributor/NetworkDashboard';
import RetailerDirectory from '../components/distributor/RetailerDirectory';
import RetailerDetail from '../components/distributor/RetailerDetail';
import CreateRetailerWizard from '../components/distributor/CreateRetailerWizard';
import DistributorProfile from '../components/distributor/DistributorProfile';
import { SERVICES } from '../lib/services';

const DistributorPortal = () => {
    const { user, token, isInitializing } = useAuth();
    const navigate = useNavigate();
    const { tab } = useParams<{ tab: string }>();
    const activeTab = tab ? tab.replace('-', '_') : 'dashboard';
    const setActiveTab = (t: string) => navigate('/distributor/' + t);
    
    const [isExistingMerchant, setIsExistingMerchant] = useState(false);
    
    // Data states
    const [retailers, setRetailers] = useState<any[]>([]);
    const [fundRequests, setFundRequests] = useState<any[]>([]);
    const [myFundRequests, setMyFundRequests] = useState<any[]>([]);
    const [loadingFR, setLoadingFR] = useState(false);
    const [frSubTab, setFrSubTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [showAddFrModal, setShowAddFrModal] = useState(false);
    const [frFormData, setFrFormData] = useState({ transactionMode: '', amount: '', bankUtr: '', depositDate: '', remarks: '' });
    const [frDepositSlip, setFrDepositSlip] = useState<File | null>(null);
    const [showMerchantKycModal, setShowMerchantKycModal] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        prefix: 'Mr', firstName: '', lastName: '', email: '', contactNumber: '', password: '', 
        dob: '', city: '', landmark: '', district: '', state: '', 
        businessName: '', businessAddress: '', 
        aadhaarNumber: '', panNumber: '', hasGst: false, gstNumber: '', otp: '',
        // Every service is on by default; the distributor switches off what they don't want.
        ...Object.fromEntries(SERVICES.map((svc) => [`svc_${svc.key}`, 'Yes'])),
        
        website: '', brandName: '', companyRegisterName: '', supportEmail: '', supportMobile: ''
    });
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [aadhaarPicture, setAadhaarPicture] = useState<File | null>(null);
    const [panPicture, setPanPicture] = useState<File | null>(null);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRetailer, setSelectedRetailer] = useState<any>(null);
    const [editingRetailer, setEditingRetailer] = useState<any>(null);
    // Shared by the overview, directory and detail views so the range sticks as you move between them.
    const [days, setDays] = useState(30);
    const [directoryPreset, setDirectoryPreset] = useState<DirectoryPreset>({});
    
    const [profileData, setProfileData] = useState<any>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [profileAadhaarPic, setProfileAadhaarPic] = useState<File | null>(null);
    const [profilePanPic, setProfilePanPic] = useState<File | null>(null);
    const [profileProfilePic, setProfileProfilePic] = useState<File | null>(null);
    const [isAadhaarLocked, setIsAadhaarLocked] = useState(false);
    const [isPanLocked, setIsPanLocked] = useState(false);

    // Verification States
    const [merchantCode, setMerchantCode] = useState('');
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);

    useEffect(() => {
        if (isInitializing) return;
        if (!user || user.role !== 'distributor') {
            navigate('/login');
            return;
        }
        fetchDashboardData();
    }, [user, isInitializing, navigate]);

    useEffect(() => {
        if (activeTab === 'create' && !merchantCode) {
            setMerchantCode('RT' + Math.floor(100000 + Math.random() * 900000).toString());
        }
    }, [activeTab, merchantCode]);

    const fetchDashboardData = async () => {
        try {
            const [retRes, profileRes, frRes, myFrRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/retailers`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/distributor`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/distributor/mine`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (retRes.ok) {
                const retData = await retRes.json();
                setRetailers(retData.data);
            }
            if (frRes.ok) {
                const frData = await frRes.json();
                setFundRequests(frData.data);
            }
            if (myFrRes.ok) {
                const myFrData = await myFrRes.json();
                setMyFundRequests(myFrData.data);
            }
            if (profileRes.ok) {
                const profData = await profileRes.json();
                setProfileData(profData.data);
                setIsAadhaarLocked(!!profData.data.aadhaarNumber);
                setIsPanLocked(!!profData.data.panNumber);
            }
        } catch (error) {
            console.error("Error fetching distributor data", error);
        }
    };

    const handleRetailerUpdated = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/retailers`, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setRetailers(data.data);
                if (selectedRetailer) {
                    const updated = data.data.find((r: any) => r._id === selectedRetailer._id);
                    if (updated) setSelectedRetailer(updated);
                }
            }
        } catch (error) {
            console.error("Error refreshing retailers", error);
        }
    };

    const openRetailer = (id: string) => {
        const match = retailers.find((r) => r._id === id);
        if (!match) return;
        setSelectedRetailer(match);
        setActiveTab('retailers');
    };

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user || user.role !== 'distributor') return null;

    const handleSendOtp = async () => {
        if (!formData.email) {
            toast.error("Please enter an email address first.");
            return;
        }
        setSendingOtp(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/send-verification-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, name: `${formData.firstName} ${formData.lastName}` })
            });
            const data = await res.json();
            if (data.success) {
                setOtpSent(true);
                toast.success("OTP sent successfully to the email.");
            } else {
                toast.error(data.message || "Failed to send OTP.");
            }
        } catch (e) {
            toast.error("System error while sending OTP.");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyEmail = async () => {
        if (!formData.otp) return toast.error("Enter Email OTP.");
        setVerifyingEmail(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/verify-email-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp: formData.otp })
            });
            const data = await res.json();
            if (data.success) {
                setIsEmailVerified(true);
                toast.success("Email verified successfully!");
            } else {
                toast.error(data.message || "Invalid Email OTP.");
            }
        } catch (e) {
            toast.error("Error verifying email.");
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!aadhaarPicture) return toast.error("Please upload Aadhaar picture.");
        if (!panPicture) return toast.error("Please upload PAN picture.");

        setIsLoading(true);
        setMessage('Creating retailer... Please wait.');

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (['city', 'landmark', 'district', 'state'].includes(key) || key.startsWith('svc_')) return;
            data.append(key, value as any);
        });
        data.append('disabledServices', JSON.stringify(
            SERVICES.filter((svc) => (formData as Record<string, unknown>)[`svc_${svc.key}`] === 'No').map((svc) => svc.key)
        ));
        data.append('address', JSON.stringify({
            city: formData.city, landmark: formData.landmark, district: formData.district, state: formData.state
        }));
        
        if (aadhaarPicture) data.append('aadhaarPicture', aadhaarPicture);
        if (panPicture) data.append('panPicture', panPicture);
        if (profilePicture) data.append('profilePicture', profilePicture);
        if (formData.otp) data.append('otp', formData.otp);
        data.append('merchantCode', merchantCode);
        data.append('isExistingMerchant', String(isExistingMerchant));

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/create-retailer`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: data
            });
            const resData = await response.json();
            if (resData.success) {
                setMessage('Retailer created successfully!');
                toast.success('Retailer created successfully!');
                fetchDashboardData(); // Refresh list
                setTimeout(() => { setActiveTab('retailers'); setMessage(''); }, 2000);
            } else {
                setMessage(resData.message || 'Failed to create retailer.');
                toast.error(resData.message || 'Failed to create retailer.');
            }
        } catch (err) {
            setMessage('Failed to create retailer.');
            toast.error('Failed to create retailer.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setProfileMessage('Updating profile...');
        
        try {
            const data = new FormData();
            data.append('name', profileData.name || '');
            data.append('contactNumber', profileData.contactNumber || '');
            data.append('businessName', profileData.businessName || '');
            data.append('businessAddress', profileData.businessAddress || '');
            if (profileData.address) data.append('address', JSON.stringify(profileData.address));
            
            if (profileData.aadhaarNumber) data.append('aadhaarNumber', profileData.aadhaarNumber);
            if (profileData.panNumber) data.append('panNumber', profileData.panNumber);
            if (profileData.hasGst !== undefined) data.append('hasGst', String(profileData.hasGst));
            if (profileData.gstNumber) data.append('gstNumber', profileData.gstNumber);
            
            if (profileAadhaarPic) data.append('aadhaarPicture', profileAadhaarPic);
            if (profilePanPic) data.append('panPicture', profilePanPic);
            if (profileProfilePic) data.append('profilePicture', profileProfilePic);

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/distributor/profile`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`
                },
                body: data
            });
            const resData = await response.json();
            if (resData.success) {
                setProfileMessage('Profile updated successfully!');
                toast.success('Profile updated successfully!');
                setProfileData(resData.data);
                setIsEditingProfile(false);
                setTimeout(() => setProfileMessage(''), 3000);
            } else {
                setProfileMessage(resData.message || 'Update failed.');
                toast.error(resData.message || 'Update failed.');
            }
        } catch (err) {
            setProfileMessage('Failed to update profile.');
            toast.error('Failed to update profile.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateKycLink = async (merchantId: string) => {
        const loadingToast = toast.loading("Generating KYC Link...");
        // Open window synchronously to bypass popup blockers
        const newWindow = window.open('', '_blank');
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/paysprint/get-onboard-url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ merchantId, isNew: true })
            });
            const data = await res.json();
            toast.dismiss(loadingToast);
            if (data.success) {
                if (data.url) {
                    try {
                        navigator.clipboard.writeText(data.url);
                        toast.success('KYC Link copied to clipboard!');
                    } catch (err) {}
                    
                    if (newWindow) {
                        newWindow.location.href = data.url;
                    } else {
                        toast.error("Popup blocked! Please allow popups or paste the copied link.");
                    }
                } else if (data.alreadyOnboarded) {
                    if (newWindow) newWindow.close();
                    setShowMerchantKycModal(true);
                }
            } else {
                if (newWindow) newWindow.close();
                toast.error(data.message || 'Failed to generate KYC link');
            }
        } catch (err) {
            if (newWindow) newWindow.close();
            toast.dismiss(loadingToast);
            toast.error('Error generating KYC link');
        }
    };

    const handleFundRequestStatus = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
        const remarks = window.prompt(`Enter remarks for ${status.toLowerCase()} (optional):`);
        if (remarks === null) return; // User cancelled

        setLoadingFR(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ requestId, status, adminRemarks: remarks })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Fund request ${status.toLowerCase()}`);
                fetchDashboardData();
            } else {
                toast.error(data.message || 'Failed to update request');
            }
        } catch (error) {
            toast.error('System error occurred');
        } finally {
            setLoadingFR(false);
        }
    };

    const handleDeleteMyFundRequest = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this fund request?")) return;
        
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/delete/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Fund request deleted successfully");
                fetchDashboardData();
            } else {
                toast.error(data.message || "Failed to delete fund request");
            }
        } catch (error) {
            toast.error("Failed to delete fund request");
        }
    };

    const handleCreateFrSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!frFormData.transactionMode || !frFormData.amount || !frFormData.bankUtr || !frFormData.depositDate) {
            return toast.error("Please fill all required fields");
        }

        const data = new FormData();
        data.append('transactionMode', frFormData.transactionMode);
        data.append('amount', frFormData.amount);
        data.append('bankUtr', frFormData.bankUtr);
        data.append('depositDate', frFormData.depositDate);
        data.append('remarks', frFormData.remarks);
        if (frDepositSlip) {
            data.append('depositSlip', frDepositSlip);
        }

        setLoadingFR(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/distributor/create`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`
                },
                body: data
            });
            const resData = await res.json();
            if (resData.success) {
                toast.success("Fund request submitted successfully");
                setShowAddFrModal(false);
                setFrFormData({ transactionMode: '', amount: '', bankUtr: '', depositDate: '', remarks: '' });
                setFrDepositSlip(null);
                fetchDashboardData();
            } else {
                toast.error(resData.message || "Failed to submit request");
            }
        } catch (error: any) {
            toast.error("System error occurred");
        } finally {
            setLoadingFR(false);
        }
    };

    return (
        <div className="w-full">
            {/* Sidebar */}
            

            {/* Main Content Area */}
            <main className="flex-1 w-full p-2 md:p-6 overflow-y-auto no-scrollbar">
                
                
                

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <NetworkDashboard
                        token={token}
                        name={user?.name}
                        days={days}
                        onDaysChange={setDays}
                        pendingFundRequests={fundRequests.filter((r) => r.status === 'PENDING').length}
                        onOpenRetailer={openRetailer}
                        onViewRetailers={(preset) => {
                            setDirectoryPreset(preset);
                            setSelectedRetailer(null);
                            setActiveTab('retailers');
                        }}
                        onNavigate={setActiveTab}
                    />
                )}

                {/* Retailers Tab */}
                {activeTab === 'retailers' && (
                    selectedRetailer ? (
                        <RetailerDetail
                            key={selectedRetailer._id}
                            token={token}
                            retailer={selectedRetailer}
                            days={days}
                            onDaysChange={setDays}
                            onBack={() => setSelectedRetailer(null)}
                            onEdit={() => setEditingRetailer(selectedRetailer)}
                            onKycLink={() => handleGenerateKycLink(selectedRetailer._id)}
                            onServicesChanged={(disabled) => {
                                setSelectedRetailer({ ...selectedRetailer, disabledServices: disabled });
                                setRetailers((list) => list.map((r) => (r._id === selectedRetailer._id ? { ...r, disabledServices: disabled } : r)));
                            }}
                        />
                    ) : (
                        <RetailerDirectory
                            key={JSON.stringify(directoryPreset)}
                            token={token}
                            days={days}
                            onDaysChange={setDays}
                            preset={directoryPreset}
                            onOpenRetailer={openRetailer}
                            onKycLink={handleGenerateKycLink}
                            onCreate={() => setActiveTab('create')}
                        />
                    )
                )}

                {/* Fund Requests Tab */}
                {activeTab === 'fund_requests' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Fund Requests</h2>
                                <p className="text-muted-foreground">Manage incoming and outgoing fund requests.</p>
                            </div>
                            <div className="flex bg-white/5 p-1 rounded-lg border border-border">
                                <button 
                                    onClick={() => setFrSubTab('incoming')} 
                                    className={`px-4 py-2 rounded-md text-sm transition-colors ${frSubTab === 'incoming' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-white'}`}
                                >
                                    From Retailers
                                </button>
                                <button 
                                    onClick={() => setFrSubTab('outgoing')} 
                                    className={`px-4 py-2 rounded-md text-sm transition-colors ${frSubTab === 'outgoing' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-white'}`}
                                >
                                    My Requests (To Admin)
                                </button>
                            </div>
                        </div>

                        {frSubTab === 'incoming' && (
                            <div className="glass-card rounded-2xl border border-border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5 border-b border-border">
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Date</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Retailer</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Amount</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Txn Mode & UTR</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Receipt</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Status</th>
                                                <th className="p-4 text-sm font-semibold text-muted-foreground">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {fundRequests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">No fund requests found.</td>
                                                </tr>
                                            ) : (
                                                fundRequests.map((req) => (
                                                    <tr key={req._id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4 text-sm text-white/70">
                                                            {new Date(req.depositDate).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="font-medium text-white">{req.retailerId?.firstName} {req.retailerId?.lastName}</div>
                                                            <div className="text-xs text-muted-foreground">{req.retailerId?.businessName}</div>
                                                            <div className="text-xs text-primary/70">{req.retailerId?.retailerId}</div>
                                                        </td>
                                                        <td className="p-4 font-bold text-white">₹{req.amount}</td>
                                                        <td className="p-4">
                                                            <div className="text-sm text-white">{req.transactionMode}</div>
                                                            <div className="text-xs font-mono text-muted-foreground">{req.bankUtr}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            {req.depositSlipUrl ? (
                                                                <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm">
                                                                    <FileText size={14} /> View
                                                                </a>
                                                            ) : <span className="text-xs text-muted-foreground">No File</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                                                req.status === 'APPROVED' ? 'text-green-500 bg-green-500/10 border-green-500/20' :
                                                                req.status === 'REJECTED' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                                                                'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                                                            }`}>
                                                                {req.status}
                                                            </span>
                                                            {req.adminRemarks && (
                                                                <div className="text-[10px] text-muted-foreground mt-1 max-w-[150px] truncate" title={req.adminRemarks}>
                                                                    {req.adminRemarks}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            {req.status === 'PENDING' && (
                                                                <div className="flex items-center gap-2">
                                                                    <button 
                                                                        disabled={loadingFR}
                                                                        onClick={() => handleFundRequestStatus(req._id, 'APPROVED')}
                                                                        className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-md transition-colors disabled:opacity-50"
                                                                        title="Approve & Credit Wallet"
                                                                    >
                                                                        <CheckCircle size={18} />
                                                                    </button>
                                                                    <button 
                                                                        disabled={loadingFR}
                                                                        onClick={() => handleFundRequestStatus(req._id, 'REJECTED')}
                                                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
                                                                        title="Reject"
                                                                    >
                                                                        <XCircle size={18} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {frSubTab === 'outgoing' && (
                            <div className="space-y-6">
                                <div className="flex justify-end">
                                    <button 
                                        onClick={() => setShowAddFrModal(true)}
                                        className="px-5 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-all flex items-center gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" /> Request Funds from Admin
                                    </button>
                                </div>
                                <div className="glass-card rounded-2xl border border-border overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-border">
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Date</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Amount</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Txn Mode & UTR</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Receipt</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Remarks</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Status</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {myFundRequests.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="p-8 text-center text-muted-foreground">You haven't requested any funds yet.</td>
                                                    </tr>
                                                ) : (
                                                    myFundRequests.map((req) => (
                                                        <tr key={req._id} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-4 text-sm text-white/70">
                                                                {new Date(req.depositDate).toLocaleDateString()}
                                                            </td>
                                                            <td className="p-4 font-bold text-white">₹{req.amount}</td>
                                                            <td className="p-4">
                                                                <div className="text-sm text-white">{req.transactionMode}</div>
                                                                <div className="text-xs font-mono text-muted-foreground">{req.bankUtr}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                {req.depositSlipUrl ? (
                                                                    <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm">
                                                                        <FileText size={14} /> View
                                                                    </a>
                                                                ) : <span className="text-xs text-muted-foreground">No File</span>}
                                                            </td>
                                                            <td className="p-4 text-sm text-white/70 max-w-[150px] truncate" title={req.remarks}>{req.remarks || '-'}</td>
                                                            <td className="p-4">
                                                                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                                                    req.status === 'APPROVED' ? 'text-green-500 bg-green-500/10 border-green-500/20' :
                                                                    req.status === 'REJECTED' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                                                                    'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                                                                }`}>
                                                                    {req.status}
                                                                </span>
                                                                {req.adminRemarks && (
                                                                    <div className="text-[10px] text-muted-foreground mt-1 max-w-[150px] truncate" title={req.adminRemarks}>
                                                                        {req.adminRemarks}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                {req.status === 'PENDING' && (
                                                                    <button 
                                                                        onClick={() => handleDeleteMyFundRequest(req._id)}
                                                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                        title="Delete Request"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <CreateRetailerWizard
                        formData={formData}
                        setFormData={(f) => setFormData(f as typeof formData)}
                        parentName={user?.name || 'you'}
                        merchantCode={merchantCode}
                        setMerchantCode={setMerchantCode}
                        isExistingMerchant={isExistingMerchant}
                        setIsExistingMerchant={setIsExistingMerchant}
                        aadhaarPicture={aadhaarPicture} setAadhaarPicture={setAadhaarPicture}
                        panPicture={panPicture} setPanPicture={setPanPicture}
                        profilePicture={profilePicture} setProfilePicture={setProfilePicture}
                        otpSent={otpSent}
                        sendingOtp={sendingOtp}
                        isEmailVerified={isEmailVerified}
                        verifyingEmail={verifyingEmail}
                        onSendOtp={handleSendOtp}
                        onVerifyEmail={handleVerifyEmail}
                        onResetEmail={() => {
                            setOtpSent(false);
                            setIsEmailVerified(false);
                            setFormData({ ...formData, otp: '' });
                        }}
                        isLoading={isLoading}
                        message={message}
                        onSubmit={handleCreateSubmit}
                    />
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && profileData && (
                    <DistributorProfile
                        token={token}
                        profile={profileData}
                        setProfile={setProfileData}
                        isEditing={isEditingProfile}
                        setIsEditing={setIsEditingProfile}
                        isLoading={isLoading}
                        message={profileMessage}
                        onSubmit={handleProfileUpdate}
                        profilePic={profileProfilePic} setProfilePic={setProfileProfilePic}
                        aadhaarPic={profileAadhaarPic} setAadhaarPic={setProfileAadhaarPic}
                        panPic={profilePanPic} setPanPic={setProfilePanPic}
                        isAadhaarLocked={isAadhaarLocked}
                        isPanLocked={isPanLocked}
                        onViewNetwork={() => setActiveTab('dashboard')}
                    />
                )}

                {/* Bank 3 Aeps / Biometric KYC Modal */}
                {showMerchantKycModal && (
                    <MerchantKycModal onClose={() => setShowMerchantKycModal(false)} />
                )}

                {/* Edit Retailer Modal */}
                {editingRetailer && (
                    <EditRetailerModal
                        retailer={editingRetailer}
                        onClose={() => setEditingRetailer(null)}
                        onUpdated={handleRetailerUpdated}
                    />
                )}

                </main>
            {/* Add Fund Request Modal */}
            {showAddFrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1e2330] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-white/10">
                        
                        <div className="flex justify-between items-center p-6 border-b border-white/5 bg-black/20">
                            <h2 className="text-xl font-semibold text-white">Request Funds From Admin</h2>
                            <button onClick={() => setShowAddFrModal(false)} className="text-white/50 hover:text-white transition-colors">
                                <span className="font-bold text-xl">&times;</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreateFrSubmit} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                <div className="space-y-2">
                                    <label className="text-sm text-white/70">Transaction Mode *</label>
                                    <select 
                                        required
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors appearance-none"
                                        value={frFormData.transactionMode}
                                        onChange={(e) => setFrFormData({...frFormData, transactionMode: e.target.value})}
                                    >
                                        <option value="" className="bg-[#1e2330]">Select transaction mode</option>
                                        <option value="IMPS" className="bg-[#1e2330]">IMPS</option>
                                        <option value="NEFT" className="bg-[#1e2330]">NEFT</option>
                                        <option value="RTGS" className="bg-[#1e2330]">RTGS</option>
                                        <option value="UPI" className="bg-[#1e2330]">UPI</option>
                                        <option value="Cash Deposit" className="bg-[#1e2330]">Cash Deposit</option>
                                        <option value="Cheque" className="bg-[#1e2330]">Cheque</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-white/70">Deposit Amount *</label>
                                    <input 
                                        type="number" 
                                        required min="1"
                                        placeholder="Enter deposit amount" 
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                        value={frFormData.amount}
                                        onChange={(e) => setFrFormData({...frFormData, amount: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-white/70">Bank UTR / Reference ID *</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="Enter UTR number" 
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                        value={frFormData.bankUtr}
                                        onChange={(e) => setFrFormData({...frFormData, bankUtr: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-white/70">Deposit Date *</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                                        value={frFormData.depositDate}
                                        onChange={(e) => setFrFormData({...frFormData, depositDate: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm text-white/70">Upload Deposit Slip</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,.pdf"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                                        onChange={(e) => setFrDepositSlip(e.target.files ? e.target.files[0] : null)}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm text-white/70">Remark</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Add any remarks..."
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none"
                                        value={frFormData.remarks}
                                        onChange={(e) => setFrFormData({...frFormData, remarks: e.target.value})}
                                    />
                                </div>

                            </div>

                            <div className="mt-8 flex justify-center">
                                <button 
                                    type="submit"
                                    disabled={loadingFR}
                                    className="px-12 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/25"
                                >
                                    {loadingFR ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DistributorPortal;
