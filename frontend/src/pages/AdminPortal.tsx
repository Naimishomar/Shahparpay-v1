import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    Users, 
    UserPlus, 
    LayoutDashboard, 
    LogOut, 
    Activity, 
    CreditCard, 
    Briefcase,
    ShieldCheck,
    UserCircle,
    ChevronLeft,
    Wallet,
    Clock,
    Store,
    CheckCircle,
    XCircle,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';

const AdminPortal = () => {
    const { user, token, logout, isInitializing } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    
    // Data states
    const [stats, setStats] = useState({ totalDistributors: 0, totalRetailers: 0, activeUsers: 0, totalTransactions: 0 });
    const [distributors, setDistributors] = useState<any[]>([]);
    const [fundRequests, setFundRequests] = useState<any[]>([]);
    const [loadingFR, setLoadingFR] = useState(false);
    
    // Form states
    const [formData, setFormData] = useState({
        prefix: 'Mr', firstName: '', lastName: '', email: '', contactNumber: '', password: '', 
        dob: '', city: '', landmark: '', district: '', state: '', 
        businessName: '', businessAddress: '', 
        aadhaarNumber: '', panNumber: '', hasGst: false, gstNumber: '', otp: '',
        dmtPackage: '', rechargePackage: '', aepsPackage: '', bbpsPackage: '', payoutPackage: '',
        cmsPackage: '', ccpayPackage: '', payinPackage: '', upiPackage: '', 
        website: '', brandName: '', companyRegisterName: '', supportEmail: '', supportMobile: ''
    });
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [aadhaarPicture, setAadhaarPicture] = useState<File | null>(null);
    const [panPicture, setPanPicture] = useState<File | null>(null);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDistributor, setSelectedDistributor] = useState<any>(null);
    const [selectedRetailer, setSelectedRetailer] = useState<any>(null);
    
    const [profileData, setProfileData] = useState<any>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [profileAadhaarPic, setProfileAadhaarPic] = useState<File | null>(null);
    const [profilePanPic, setProfilePanPic] = useState<File | null>(null);
    const [profileProfilePic, setProfileProfilePic] = useState<File | null>(null);

    // Verification States
    const [merchantCode, setMerchantCode] = useState('');
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);


    useEffect(() => {
        if (isInitializing) return;
        if (!user || user.role !== 'admin') {
            navigate('/login');
            return;
        }
        fetchDashboardData();
    }, [user, isInitializing, navigate]);

    useEffect(() => {
        if (activeTab === 'create' && !merchantCode) {
            setMerchantCode('DT' + Math.floor(100000 + Math.random() * 900000).toString());
        }
    }, [activeTab, merchantCode]);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, distRes, profileRes, frRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/distributors`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/admin`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData.data);
            }
            if (distRes.ok) {
                const distData = await distRes.json();
                setDistributors(distData.data);
            }
            if (profileRes.ok) {
                const profData = await profileRes.json();
                setProfileData(profData.data);
            }
            if (frRes.ok) {
                const frData = await frRes.json();
                setFundRequests(frData.data);
            }
        } catch (error) {
            console.error('Error fetching admin dashboard data:', error);
            toast.error('Failed to load dashboard data');
        }
    };

    if (isInitializing) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

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

        if (!isEmailVerified) return toast.error("Please verify Email first.");
        if (!aadhaarPicture) return toast.error("Please upload Aadhaar picture.");
        if (!panPicture) return toast.error("Please upload PAN picture.");

        setIsLoading(true);
        setMessage('Creating distributor... Please wait.');

        const data = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            if (['city', 'landmark', 'district', 'state'].includes(key)) return;
            data.append(key, value as any);
        });
        data.append('address', JSON.stringify({
            city: formData.city, landmark: formData.landmark, district: formData.district, state: formData.state
        }));
        
        if (aadhaarPicture) data.append('aadhaarPicture', aadhaarPicture);
        if (panPicture) data.append('panPicture', panPicture);
        if (profilePicture) data.append('profilePicture', profilePicture);
        if (formData.otp) data.append('otp', formData.otp);
        data.append('merchantCode', merchantCode);

        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/create-distributor`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: data
            });
            const resData = await response.json();
            if (resData.success) {
                setMessage('Distributor created successfully!');
                toast.success('Distributor created successfully!');
                fetchDashboardData(); // Refresh list
                setTimeout(() => { setActiveTab('distributors'); setMessage(''); }, 2000);
            } else {
                setMessage(resData.message || 'Failed to create distributor.');
                toast.error(resData.message || 'Failed to create distributor.');
            }
        } catch (err) {
            setMessage('Failed to create distributor.');
            toast.error('Failed to create distributor.');
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

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/profile`, {
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
            if (data.success && data.url) {
                window.open(data.url, '_blank');
            } else {
                toast.error(data.message || 'Failed to generate KYC link');
            }
        } catch (err) {
            toast.error('Error generating KYC link');
        }
    };

    const handleFundRequestStatus = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
        const remarks = window.prompt(`Enter remarks for ${status.toLowerCase()} (optional):`);
        if (remarks === null) return; // User cancelled

        setLoadingFR(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/admin/update`, {
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

    return (
        <div className="min-h-screen bg-background flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 border-r border-border bg-card/50 p-6 flex flex-col gap-8 hidden md:flex h-screen sticky top-0">
                <div>
                    <h1 className="text-2xl font-bold text-glow tracking-tight">Admin HQ</h1>
                    <p className="text-xs text-muted-foreground mt-1">v2.0 Platform Management</p>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-primary text-primary-foreground font-medium shadow-lg' : 'hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}>
                        <LayoutDashboard size={18} /> Overview
                    </button>
                    <button onClick={() => setActiveTab('distributors')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'distributors' ? 'bg-primary text-primary-foreground font-medium shadow-lg' : 'hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}>
                        <Users size={18} /> Distributors
                    </button>
                    <button onClick={() => setActiveTab('fund_requests')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'fund_requests' ? 'bg-primary text-primary-foreground font-medium shadow-lg' : 'hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}>
                        <Store size={18} /> Fund Requests
                    </button>
                    <button onClick={() => setActiveTab('create')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'create' ? 'bg-primary text-primary-foreground font-medium shadow-lg' : 'hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}>
                        <UserPlus size={18} /> Add New
                    </button>
                    <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'profile' ? 'bg-primary text-primary-foreground font-medium shadow-lg' : 'hover:bg-muted/10 text-muted-foreground hover:text-foreground'}`}>
                        <UserCircle size={18} /> My Profile
                    </button>
                </nav>

                <div className="pt-6 border-t border-border">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-foreground font-bold">
                            {user.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                    <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center justify-center gap-2 w-full py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto no-scrollbar">
                
                {/* Mobile Header (Hidden on Desktop) */}
                <div className="md:hidden flex justify-between items-center mb-8 pb-4 border-b border-border">
                    <h1 className="text-xl font-bold">Admin HQ</h1>
                    <button onClick={() => { logout(); navigate('/login'); }} className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                        <LogOut size={18} />
                    </button>
                </div>
                {/* Mobile Tabs */}
                <div className="md:hidden flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
                    {['dashboard', 'distributors', 'fund_requests', 'create', 'profile'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm rounded-full whitespace-nowrap capitalize ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted/10 border border-border'}`}>
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="mb-8">
                            <h2 className="text-3xl font-bold mb-2">Platform Overview</h2>
                            <p className="text-muted-foreground">Monitor your network's growth and metrics in real-time.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            {/* Stat Card 1 */}
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-muted/10 rounded-xl text-foreground"><Users size={24} /></div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-green-500/20 text-green-400 rounded-full">+12%</span>
                                </div>
                                <h3 className="text-3xl font-bold mb-1">{stats.totalDistributors}</h3>
                                <p className="text-sm text-muted-foreground">Total Distributors</p>
                                <div className="absolute -bottom-4 -right-4 text-foreground/5 group-hover:text-foreground/10 transition-colors pointer-events-none">
                                    <Users size={100} />
                                </div>
                            </div>

                            {/* Stat Card 2 */}
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-muted/10 rounded-xl text-foreground"><Briefcase size={24} /></div>
                                </div>
                                <h3 className="text-3xl font-bold mb-1">{stats.totalRetailers}</h3>
                                <p className="text-sm text-muted-foreground">Total Retailers</p>
                                <div className="absolute -bottom-4 -right-4 text-foreground/5 group-hover:text-foreground/10 transition-colors pointer-events-none">
                                    <Briefcase size={100} />
                                </div>
                            </div>

                            {/* Stat Card 3 */}
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-muted/10 rounded-xl text-foreground"><Activity size={24} /></div>
                                </div>
                                <h3 className="text-3xl font-bold mb-1">{stats.activeUsers}</h3>
                                <p className="text-sm text-muted-foreground">Total Network Size</p>
                                <div className="absolute -bottom-4 -right-4 text-foreground/5 group-hover:text-foreground/10 transition-colors pointer-events-none">
                                    <Activity size={100} />
                                </div>
                            </div>

                            {/* Stat Card 4 */}
                            <div className="glass-card p-6 rounded-2xl relative overflow-hidden group border-primary/20 bg-primary/5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-primary/20 rounded-xl text-foreground"><CreditCard size={24} /></div>
                                </div>
                                <h3 className="text-3xl font-bold mb-1">₹ 0.00</h3>
                                <p className="text-sm text-muted-foreground">Total Trx Volume</p>
                            </div>
                        </div>

                        <div className="glass-card p-8 rounded-3xl border-border">
                            <h3 className="text-xl font-bold mb-6">Recent Platform Activity</h3>
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                <Activity className="mb-4 opacity-50" size={48} />
                                <p>Activity feed will appear here as transactions happen.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Fund Requests Tab */}
                {activeTab === 'fund_requests' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="mb-8 flex justify-between items-end">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Fund Requests</h2>
                                <p className="text-muted-foreground">Manage incoming fund requests from your distributors.</p>
                            </div>
                        </div>

                        <div className="glass-card rounded-2xl border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/10 border-b border-border">
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Date</th>
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Distributor</th>
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
                                                <tr key={req._id} className="hover:bg-muted/10 transition-colors">
                                                    <td className="p-4 text-sm text-foreground/70">
                                                        {new Date(req.depositDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-foreground">{req.distributorId?.firstName} {req.distributorId?.lastName}</div>
                                                        <div className="text-xs text-muted-foreground">{req.distributorId?.businessName}</div>
                                                        <div className="text-xs text-primary/70">{req.distributorId?.distributorId}</div>
                                                    </td>
                                                    <td className="p-4 font-bold text-foreground">₹{req.amount}</td>
                                                    <td className="p-4">
                                                        <div className="text-sm text-foreground">{req.transactionMode}</div>
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
                    </div>
                )}

                {/* Distributors Tab */}
                {activeTab === 'distributors' && (
                    <div className="animate-in slide-in-from-right-8 duration-500">
                        {selectedRetailer ? (
                            <div>
                                <button onClick={() => setSelectedRetailer(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
                                    <ChevronLeft size={18} /> Back to {selectedDistributor?.name || 'Distributor'}
                                </button>
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h2 className="text-3xl font-bold mb-2">{selectedRetailer.name}</h2>
                                        <p className="text-muted-foreground">Retailer ID: <span className="text-foreground font-mono">{selectedRetailer.retailerId}</span></p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg flex items-center gap-2 font-medium">
                                            <ShieldCheck size={18} /> Active
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="glass-card p-8 rounded-3xl border border-border space-y-6">
                                        <h3 className="text-xl font-bold border-b border-border pb-4 flex items-center gap-2"><UserCircle size={20}/> Personal Info</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                                                <p className="font-medium">{selectedRetailer.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Contact Number</p>
                                                <p className="font-medium">{selectedRetailer.contactNumber}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-sm text-muted-foreground mb-1">Address</p>
                                                <p className="font-medium">{selectedRetailer.address?.city}, {selectedRetailer.address?.district}, {selectedRetailer.address?.state}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass-card p-8 rounded-3xl border border-border space-y-6">
                                        <h3 className="text-xl font-bold border-b border-border pb-4 flex items-center gap-2"><Briefcase size={20}/> Business & Legal Info</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                                                <p className="font-medium">{selectedRetailer.businessName}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Business Address</p>
                                                <p className="font-medium">{selectedRetailer.businessAddress}</p>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <p className="text-sm text-muted-foreground mb-2 flex justify-between items-center">
                                                    Aadhaar Number <span className="font-medium font-mono text-foreground">{selectedRetailer.aadhaarNumber}</span>
                                                </p>
                                                {selectedRetailer.aadhaarPicture ? (
                                                    <a href={selectedRetailer.aadhaarPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border">
                                                        <img src={selectedRetailer.aadhaarPicture} alt="Aadhaar" className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-sm font-medium text-foreground">View Full</span>
                                                        </div>
                                                    </a>
                                                ) : <span className="text-xs text-muted-foreground">Not uploaded</span>}
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <p className="text-sm text-muted-foreground mb-2 flex justify-between items-center">
                                                    PAN Number <span className="font-medium font-mono text-foreground">{selectedRetailer.panNumber}</span>
                                                </p>
                                                {selectedRetailer.panPicture ? (
                                                    <a href={selectedRetailer.panPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border">
                                                        <img src={selectedRetailer.panPicture} alt="PAN" className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-sm font-medium text-foreground">View Full</span>
                                                        </div>
                                                    </a>
                                                ) : <span className="text-xs text-muted-foreground">Not uploaded</span>}
                                            </div>
                                            {selectedRetailer.hasGst && (
                                                <div className="col-span-2">
                                                    <p className="text-sm text-muted-foreground mb-1">GST Number</p>
                                                    <p className="font-medium font-mono">{selectedRetailer.gstNumber}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : selectedDistributor ? (
                            <div>
                                <button onClick={() => setSelectedDistributor(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
                                    <ChevronLeft size={18} /> Back to Distributors
                                </button>
                                <div className="flex justify-between items-end mb-8">
                                    <div className="flex items-center gap-6">
                                        {selectedDistributor.profilePicture ? (
                                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-inner border border-border">
                                                <img src={selectedDistributor.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-foreground font-bold text-3xl shadow-inner border border-border">
                                                {selectedDistributor.name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <h2 className="text-3xl font-bold mb-2">{selectedDistributor.name}</h2>
                                            <p className="text-muted-foreground">Distributor ID: <span className="text-foreground font-mono">{selectedDistributor.distributorId}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="px-4 py-2 bg-primary/10 border border-primary/20 text-primary-foreground rounded-lg flex items-center gap-2 font-medium">
                                            <Wallet size={18} /> Commissions: ₹{selectedDistributor.commissionsEarned?.toFixed(2) || '0.00'}
                                        </div>
                                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg flex items-center gap-2 font-medium">
                                            <ShieldCheck size={18} /> Active
                                        </div>
                                        {!selectedDistributor.isMerchantKycComplete && (
                                            <button 
                                                onClick={() => handleGenerateKycLink(selectedDistributor._id)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-foreground rounded-lg transition-colors font-medium flex items-center gap-2 border border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)]"
                                            >
                                                Generate KYC Link
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="glass-card p-8 rounded-3xl border border-border space-y-6">
                                        <h3 className="text-xl font-bold border-b border-border pb-4 flex items-center gap-2"><UserCircle size={20}/> Personal Info</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                                                <p className="font-medium">{selectedDistributor.email}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Contact Number</p>
                                                <p className="font-medium">{selectedDistributor.contactNumber}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-sm text-muted-foreground mb-1">Address</p>
                                                <p className="font-medium">{selectedDistributor.address?.city}, {selectedDistributor.address?.district}, {selectedDistributor.address?.state}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass-card p-8 rounded-3xl border border-border space-y-6">
                                        <h3 className="text-xl font-bold border-b border-border pb-4 flex items-center gap-2"><Briefcase size={20}/> Business & Legal Info</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                                                <p className="font-medium">{selectedDistributor.businessName}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">Business Address</p>
                                                <p className="font-medium">{selectedDistributor.businessAddress}</p>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <p className="text-sm text-muted-foreground mb-2 flex justify-between items-center">
                                                    Aadhaar Number <span className="font-medium font-mono text-foreground">{selectedDistributor.aadhaarNumber}</span>
                                                </p>
                                                {selectedDistributor.aadhaarPicture ? (
                                                    <a href={selectedDistributor.aadhaarPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border">
                                                        <img src={selectedDistributor.aadhaarPicture} alt="Aadhaar" className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-sm font-medium text-foreground">View Full</span>
                                                        </div>
                                                    </a>
                                                ) : <span className="text-xs text-muted-foreground">Not uploaded</span>}
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <p className="text-sm text-muted-foreground mb-2 flex justify-between items-center">
                                                    PAN Number <span className="font-medium font-mono text-foreground">{selectedDistributor.panNumber}</span>
                                                </p>
                                                {selectedDistributor.panPicture ? (
                                                    <a href={selectedDistributor.panPicture} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-border">
                                                        <img src={selectedDistributor.panPicture} alt="PAN" className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-sm font-medium text-foreground">View Full</span>
                                                        </div>
                                                    </a>
                                                ) : <span className="text-xs text-muted-foreground">Not uploaded</span>}
                                            </div>
                                            {selectedDistributor.hasGst && (
                                                <div className="col-span-2">
                                                    <p className="text-sm text-muted-foreground mb-1">GST Number</p>
                                                    <p className="font-medium font-mono">{selectedDistributor.gstNumber}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 glass-card p-8 rounded-3xl border border-border">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold flex items-center gap-2"><Store size={20}/> Associated Retailers</h3>
                                        <span className="px-3 py-1 bg-muted/20 rounded-full text-sm font-medium">{selectedDistributor.retailers?.length || 0} Total</span>
                                    </div>
                                    
                                    <div className="overflow-x-auto rounded-xl border border-border">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/10 border-b border-border">
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Retailer ID</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Name</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Contact</th>
                                                    <th className="p-4 text-sm font-semibold text-muted-foreground">Business</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {!selectedDistributor.retailers || selectedDistributor.retailers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="p-6 text-center text-muted-foreground">No retailers associated with this distributor yet.</td>
                                                    </tr>
                                                ) : (
                                                    selectedDistributor.retailers.map((ret: any) => (
                                                        <tr key={ret._id} onClick={() => setSelectedRetailer(ret)} className="hover:bg-muted/10 transition-colors cursor-pointer group">
                                                            <td className="p-4 font-mono text-sm text-foreground group-hover:text-foreground transition-colors">{ret.retailerId}</td>
                                                            <td className="p-4">
                                                                <div className="font-medium">{ret.name}</div>
                                                                <div className="text-xs text-muted-foreground">{ret.email}</div>
                                                            </td>
                                                            <td className="p-4 text-sm">{ret.contactNumber}</td>
                                                            <td className="p-4 text-sm">{ret.businessName}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h2 className="text-3xl font-bold mb-2">Network Distributors</h2>
                                        <p className="text-muted-foreground">Manage your direct downstream partners.</p>
                                    </div>
                                    <button onClick={() => setActiveTab('create')} className="px-5 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg flex items-center gap-2">
                                        <UserPlus size={18} /> New
                                    </button>
                                </div>

                                <div className="glass-card rounded-2xl border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted/10 border-b border-border">
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Distributor ID</th>
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Name</th>
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Contact</th>
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Business</th>
                                            <th className="p-4 text-sm font-semibold text-muted-foreground">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {distributors.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">No distributors found. Click "New" to create one.</td>
                                            </tr>
                                        ) : (
                                            distributors.map((dist) => (
                                                <tr key={dist._id} onClick={() => setSelectedDistributor(dist)} className="hover:bg-muted/10 transition-colors cursor-pointer">
                                                    <td className="p-4 font-mono text-sm text-foreground">{dist.distributorId}</td>
                                                    <td className="p-4">
                                                        <div className="font-medium">{dist.name}</div>
                                                        <div className="text-xs text-muted-foreground">{dist.email}</div>
                                                    </td>
                                                    <td className="p-4 text-sm">{dist.contactNumber}</td>
                                                    <td className="p-4 text-sm">{dist.businessName}</td>
                                                    <td className="p-4">
                                                        {dist.isMerchantKycComplete ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                                <ShieldCheck size={14} /> Verified
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                                    <Clock size={14} /> Pending
                                                                </div>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleGenerateKycLink(dist._id); }}
                                                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-foreground rounded text-xs font-medium transition-colors"
                                                                >
                                                                    Gen Link
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
                        </>
                        )}
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <div className="animate-in slide-in-from-bottom-8 duration-500">
                        <div className="max-w-7xl mx-auto">
                            <div className="mb-8">
                                <h2 className="text-3xl font-bold mb-2">Onboard Distributor</h2>
                                <p className="text-muted-foreground">Register a new distributor onto the platform. They will receive credentials via email (Mock).</p>
                            </div>
                            
                            <div className="glass-card p-8 rounded-3xl border border-border">
                                {message && (
                                    <div className={`mb-6 p-4 rounded-xl text-sm border ${message.includes('success') ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-primary/10 border-primary/20 text-primary-foreground'}`}>
                                        {message}
                                    </div>
                                )}

                                <form onSubmit={handleCreateSubmit} className="space-y-8">
                                    <div className="space-y-12">
                                        
                                        {/* SECTION: Personal Information */}
                                        <div>
                                            <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 text-foreground">1. Personal Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign Role *</label>
                                                    <input value="Distributor" disabled className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none text-muted-foreground cursor-not-allowed" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Distributor ID (Auto-Generated) *</label>
                                                    <input value={merchantCode} disabled className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none font-mono text-muted-foreground cursor-not-allowed" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Parent *</label>
                                                    <input value={user?.name || 'Self'} disabled className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none text-muted-foreground cursor-not-allowed" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Prefix *</label>
                                                    <select name="prefix" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none">
                                                        <option value="Mr">Mr</option>
                                                        <option value="Mrs">Mrs</option>
                                                        <option value="Miss">Miss</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">First Name *</label>
                                                    <input name="firstName" placeholder="First Name" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Last Name *</label>
                                                    <input name="lastName" placeholder="Last Name" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground flex justify-between">
                                                        Email * 
                                                        {isEmailVerified ? (
                                                            <span className="text-green-500 text-xs flex items-center">Verified!</span>
                                                        ) : otpSent ? (
                                                            <span className="text-green-500 text-xs flex items-center">Sent!</span>
                                                        ) : (
                                                            <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="text-blue-500 text-xs font-bold hover:underline">
                                                                {sendingOtp ? 'Sending...' : 'Send OTP'}
                                                            </button>
                                                        )}
                                                    </label>
                                                    <input name="email" type="email" placeholder="Email Address" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" disabled={otpSent} />
                                                </div>
                                                {otpSent && !isEmailVerified && (
                                                    <div className="space-y-2 animate-in fade-in">
                                                        <label className="text-sm font-semibold text-green-500 flex justify-between">
                                                            Email OTP *
                                                            <button type="button" onClick={handleVerifyEmail} disabled={verifyingEmail} className="text-blue-500 text-xs font-bold hover:underline">
                                                                {verifyingEmail ? 'Verifying...' : 'Verify OTP'}
                                                            </button>
                                                        </label>
                                                        <input name="otp" placeholder="Enter 6-Digit OTP" onChange={handleChange} required maxLength={6} className="w-full p-3 rounded-xl bg-background border border-green-500 focus:border-green-400 outline-none transition-colors font-mono tracking-widest" />
                                                    </div>
                                                )}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Mobile *</label>
                                                    <input name="contactNumber" placeholder="Mobile Number" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Date Of Birth *</label>
                                                    <input name="dob" type="date" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Password *</label>
                                                    <input name="password" type="password" placeholder="Password" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground flex justify-between">
                                                        Profile Picture
                                                        {profilePicture && <span className="text-green-500 text-xs">Uploaded</span>}
                                                    </label>
                                                    <label className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors cursor-pointer block text-muted-foreground">
                                                        {profilePicture ? profilePicture.name : 'Choose file...'}
                                                        <input type="file" onChange={(e) => setProfilePicture(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION: Business & Identity (KYC) */}
                                        <div>
                                            <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 text-foreground">2. Business & Identity (KYC)</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Business Name *</label>
                                                    <input name="businessName" placeholder="Business Name" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground flex justify-between">
                                                        Aadhar Number *
                                                        <div className="flex gap-2">
                                                            {aadhaarPicture ? <span className="text-green-500 text-xs">Pic Uploaded</span> : (
                                                                <label className="text-blue-500 text-xs hover:underline cursor-pointer">
                                                                    Upload Pic <input type="file" onChange={(e) => setAadhaarPicture(e.target.files?.[0] || null)} required className="hidden" />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </label>
                                                    <input name="aadhaarNumber" placeholder="Enter your aadhar number" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground flex justify-between">
                                                        Pancard Number *
                                                        <div className="flex gap-2">
                                                            {panPicture ? <span className="text-green-500 text-xs">Pic Uploaded</span> : (
                                                                <label className="text-blue-500 text-xs hover:underline cursor-pointer">
                                                                    Upload Pic <input type="file" onChange={(e) => setPanPicture(e.target.files?.[0] || null)} required className="hidden" />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </label>
                                                    <input name="panNumber" placeholder="Enter your Pancard number" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Street Address *</label>
                                                    <input name="businessAddress" placeholder="Street Address" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">City *</label>
                                                    <input name="city" placeholder="City" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">District *</label>
                                                    <input name="district" placeholder="District" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">State *</label>
                                                    <input name="state" placeholder="State" onChange={handleChange} required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Landmark</label>
                                                    <input name="landmark" placeholder="Landmark (Optional)" onChange={handleChange} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Company Register Name</label>
                                                    <input name="companyRegisterName" placeholder="Company Name" onChange={handleChange} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION: Branding & Support */}
                                        <div>
                                            <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 text-foreground">3. Branding & Support</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Brand Name</label>
                                                    <input name="brandName" placeholder="Brand Name" onChange={handleChange} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Website</label>
                                                    <div className="flex">
                                                        <span className="p-3 bg-muted/10 border border-r-0 border-border rounded-l-xl text-muted-foreground text-sm">https://</span>
                                                        <input name="website" placeholder="www.company.com" onChange={handleChange} className="w-full p-3 rounded-r-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Support Email</label>
                                                    <input name="supportEmail" type="email" placeholder="support@company.com" onChange={handleChange} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Support Mobile</label>
                                                    <input name="supportMobile" placeholder="Support Mobile" onChange={handleChange} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION: Service Packages */}
                                        <div>
                                            <h3 className="text-xl font-bold mb-6 border-b border-border pb-2 text-foreground">4. Service Packages</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign DMT Package</label>
                                                    <select name="dmtPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign Recharge Package</label>
                                                    <select name="rechargePackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign Aeps Package</label>
                                                    <select name="aepsPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign BBPS Package</label>
                                                    <select name="bbpsPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign Payout Package</label>
                                                    <select name="payoutPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign CMS Package</label>
                                                    <select name="cmsPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign CCPAY Package</label>
                                                    <select name="ccpayPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign Payin Package</label>
                                                    <select name="payinPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold text-muted-foreground">Assign UPI Package</label>
                                                    <select name="upiPackage" onChange={(e: any) => handleChange(e)} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors appearance-none text-sm">
                                                        <option value="">Choose Commission Package</option>
                                                        <option value="Standard">Standard Package</option>
                                                        <option value="Premium">Premium Package</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-8">
                                        <button disabled={isLoading || !otpSent} type="submit" className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg hover:shadow-primary/20 hover:scale-[0.99] transition-all disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2">
                                            {isLoading ? <div className="w-6 h-6 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div> : <><UserPlus size={20}/> Complete Onboarding</>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && profileData && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">My Profile</h2>
                                <p className="text-muted-foreground">Manage your personal and business details.</p>
                            </div>
                            <button onClick={() => setIsEditingProfile(!isEditingProfile)} className={`px-5 py-2.5 font-medium rounded-lg transition-colors ${isEditingProfile ? 'bg-muted/20 text-foreground border border-border' : 'bg-primary text-primary-foreground'}`}>
                                {isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}
                            </button>
                        </div>

                        <div className="glass-card p-8 rounded-3xl border border-border max-w-3xl">
                            {profileMessage && (
                                <div className={`mb-6 p-4 rounded-xl text-sm border ${profileMessage.includes('success') ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-primary/10 border-primary/20 text-primary-foreground'}`}>
                                    {profileMessage}
                                </div>
                            )}

                            {isEditingProfile ? (
                                <form onSubmit={handleProfileUpdate} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold border-b border-border pb-2 text-muted-foreground">Personal</h3>
                                            <input value={profileData.name || ''} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" placeholder="Full Name" required />
                                            <input value={profileData.contactNumber || ''} onChange={(e) => setProfileData({...profileData, contactNumber: e.target.value})} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" placeholder="Contact Number" required />
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-lg font-semibold border-b border-border pb-2 text-muted-foreground">Business</h3>
                                            <input value={profileData.businessName || ''} onChange={(e) => setProfileData({...profileData, businessName: e.target.value})} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" placeholder="Business Name" required />
                                            <input value={profileData.businessAddress || ''} onChange={(e) => setProfileData({...profileData, businessAddress: e.target.value})} className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" placeholder="Business Address" required />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 pt-4">
                                        <h3 className="text-lg font-semibold border-b border-border pb-2 text-muted-foreground">Legal Documents</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <div className="p-4 border border-dashed border-border rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors relative cursor-pointer group">
                                                    <label className="flex flex-col items-center justify-center cursor-pointer">
                                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{profileProfilePic ? profileProfilePic.name : 'Update Profile Picture'}</span>
                                                        <input type="file" onChange={(e) => setProfileProfilePic(e.target.files?.[0] || null)} className="hidden" accept="image/*" />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <input value={profileData.aadhaarNumber || ''} onChange={(e) => setProfileData({...profileData, aadhaarNumber: e.target.value})} placeholder="12-Digit Aadhaar Number" required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                <div className="p-4 border border-dashed border-border rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors relative cursor-pointer group">
                                                    <label className="flex flex-col items-center justify-center cursor-pointer">
                                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{profileAadhaarPic ? profileAadhaarPic.name : 'Update Aadhaar Picture'}</span>
                                                        <input type="file" onChange={(e) => setProfileAadhaarPic(e.target.files?.[0] || null)} className="hidden" />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <input value={profileData.panNumber || ''} onChange={(e) => setProfileData({...profileData, panNumber: e.target.value})} placeholder="10-Digit PAN Number" required className="w-full p-3 rounded-xl bg-background border border-border focus:border-primary outline-none transition-colors" />
                                                <div className="p-4 border border-dashed border-border rounded-xl bg-muted/10 hover:bg-muted/20 transition-colors relative cursor-pointer group">
                                                    <label className="flex flex-col items-center justify-center cursor-pointer">
                                                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{profilePanPic ? profilePanPic.name : 'Update PAN Picture'}</span>
                                                        <input type="file" onChange={(e) => setProfilePanPic(e.target.files?.[0] || null)} className="hidden" />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-muted/10 rounded-xl border border-border">
                                            <div className="flex items-center gap-2">
                                                <input type="checkbox" id="profileHasGst" checked={profileData.hasGst || false} onChange={(e) => setProfileData({...profileData, hasGst: e.target.checked})} className="w-4 h-4 accent-primary" />
                                                <label htmlFor="profileHasGst" className="text-sm font-medium">Business has GST Registration?</label>
                                            </div>
                                            {profileData.hasGst && (
                                                <input value={profileData.gstNumber || ''} placeholder="Enter GST Number" onChange={(e) => setProfileData({...profileData, gstNumber: e.target.value})} className="flex-1 p-2 rounded-lg bg-background border border-border focus:border-primary outline-none transition-colors text-sm" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4 border-t border-border">
                                        <button disabled={isLoading} type="submit" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center gap-2 hover:scale-[0.98] transition-all disabled:opacity-70">
                                            {isLoading ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div> : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-6 pb-8 border-b border-border">
                                        <div className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center text-foreground font-bold text-4xl shadow-inner overflow-hidden">
                                            {profileData.profilePicture ? (
                                                <img src={profileData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                profileData.name.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold">{profileData.name}</h3>
                                            <p className="text-muted-foreground flex items-center gap-2 mt-1"><ShieldCheck size={16}/> Super Admin ({profileData.adminId})</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Email Address</p>
                                            <p className="font-medium">{profileData.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Contact Number</p>
                                            <p className="font-medium">{profileData.contactNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                                            <p className="font-medium">{profileData.businessName}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Business Address</p>
                                            <p className="font-medium">{profileData.businessAddress}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Aadhaar Number</p>
                                            <p className="font-medium font-mono">{profileData.aadhaarNumber}</p>
                                            {profileData.aadhaarPicture && <a href={profileData.aadhaarPicture} target="_blank" rel="noreferrer" className="text-xs text-foreground hover:underline mt-1 inline-block">View Document</a>}
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">PAN Number</p>
                                            <p className="font-medium font-mono">{profileData.panNumber}</p>
                                            {profileData.panPicture && <a href={profileData.panPicture} target="_blank" rel="noreferrer" className="text-xs text-foreground hover:underline mt-1 inline-block">View Document</a>}
                                        </div>
                                        {profileData.hasGst && (
                                            <div>
                                                <p className="text-sm text-muted-foreground mb-1">GST Number</p>
                                                <p className="font-medium font-mono">{profileData.gstNumber}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPortal;
