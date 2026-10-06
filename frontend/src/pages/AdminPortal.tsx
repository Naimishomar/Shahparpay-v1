import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import AdminNotifications from '../components/AdminNotifications';
import AdminSupport from '../components/AdminSupport';
import AdminOverview from '../components/admin/AdminOverview';
import TransactionExplorer, { type TxnQuery } from '../components/admin/TransactionExplorer';
import UserDirectory, { type UserQuery } from '../components/admin/UserDirectory';
import UserDetail from '../components/admin/UserDetail';
import ActivityLog from '../components/admin/ActivityLog';
import CreateRetailerWizard from '../components/distributor/CreateRetailerWizard';
import DistributorProfile from '../components/distributor/DistributorProfile';
import AdminFundRequests from '../components/admin/AdminFundRequests';

const AdminPortal = () => {
    const { user, token, isInitializing } = useAuth();
    const navigate = useNavigate();
    const { tab } = useParams<{ tab: string }>();
    const activeTab = tab ? tab.replace('-', '_') : 'dashboard';
    const setActiveTab = (t: string) => navigate('/admin/' + t);
    const [searchParams] = useSearchParams();
    // Console drill-downs ride in history state: the browser back button walks
    // back through them, and a plain sidebar link opens a fresh, unfiltered list.
    const navState = (useLocation().state || {}) as { viewUser?: { role: 'retailer' | 'distributor'; id: string }; txnQuery?: TxnQuery };
    const viewUser = navState.viewUser || null;
    const txnQuery = navState.txnQuery || {};
    const openUser = (role: 'retailer' | 'distributor', id: string) => {
        navigate('/admin/users', { state: { viewUser: { role, id } } });
        window.scrollTo({ top: 0 });
    };
    const openTransactions = (query: TxnQuery) => {
        navigate('/admin/transactions', { state: { txnQuery: query } });
        window.scrollTo({ top: 0 });
    };
    
    // Data states
    const [fundRequests, setFundRequests] = useState<any[]>([]);
    const [loadingFR, setLoadingFR] = useState(false);
    
    // Form states
    const [formData, setFormData] = useState({
        prefix: 'Mr', firstName: '', lastName: '', email: '', contactNumber: '', password: '', 
        dob: '', city: '', landmark: '', district: '', state: '', 
        businessName: '', businessAddress: '', 
        aadhaarNumber: '', panNumber: '', hasGst: false, gstNumber: '', otp: '',
        website: '', brandName: '', companyRegisterName: '', supportEmail: '', supportMobile: ''
    });
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [aadhaarPicture, setAadhaarPicture] = useState<File | null>(null);
    const [panPicture, setPanPicture] = useState<File | null>(null);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
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
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);


    useEffect(() => {
        if (isInitializing) return;
        if (!user || user.role !== 'admin') {
            navigate('/login');
            return;
        }
        fetchDashboardData();

        const sse = new EventSource(`${import.meta.env.VITE_BACKEND_URL}/api/admin/live-transactions?token=${token}`);
        sse.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.message === "Connected") return;
                
                setRecentTransactions(prev => {
                    if (prev.some(t => t._id === data._id)) return prev;
                    
                    // The header re-reads the admin wallet on this event.
                    if (data.commissions?.adminEarned > 0) window.dispatchEvent(new Event('wallet-updated'));
                    
                    return [data, ...prev].slice(0, 10);
                });
            } catch (err) {
                console.error("Error parsing SSE data", err);
            }
        };

        return () => sse.close();
    }, [user, isInitializing, navigate, token]);

    useEffect(() => {
        if (activeTab === 'create' && !merchantCode) {
            setMerchantCode('DT' + Math.floor(100000 + Math.random() * 900000).toString());
        }
    }, [activeTab, merchantCode]);

    const fetchDashboardData = async () => {
        try {
            const [profileRes, frRes, recentTxRes] = await Promise.all([
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/profile`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/fund-request/admin`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/recent-transactions`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            if (profileRes.ok) {
                const profData = await profileRes.json();
                setProfileData(profData.data);
            }
            if (frRes.ok) {
                const frData = await frRes.json();
                setFundRequests(frData.data);
            }
            if (recentTxRes.ok) {
                const txData = await recentTxRes.json();
                setRecentTransactions(txData.data || []);
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
                setTimeout(() => { setActiveTab('users?role=distributor'); setMessage(''); }, 2000);
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

    // Remarks come from the confirm panel in AdminFundRequests (no browser prompt).
    const handleFundRequestStatus = async (requestId: string, status: 'APPROVED' | 'REJECTED', remarks: string) => {
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
        <div className="w-full">
            {/* Sidebar */}
            

            {/* Main Content Area */}
            <main className="flex-1 w-full p-2 md:p-6 overflow-y-auto no-scrollbar">
                
                
                

                {/* Dashboard Tab */}
                {activeTab === 'notifications' && <AdminNotifications />}
                {activeTab === 'support' && <AdminSupport />}
                {activeTab === 'dashboard' && (
                    <AdminOverview
                        token={token}
                        live={recentTransactions}
                        onNavigate={setActiveTab}
                        onOpenUser={openUser}
                        onOpenTransactions={openTransactions}
                    />
                )}

                {activeTab === 'transactions' && (
                    <TransactionExplorer key={JSON.stringify(txnQuery)} token={token} initial={txnQuery} onOpenUser={openUser} />
                )}

                {activeTab === 'users' && (
                    viewUser ? (
                        <UserDetail
                            key={`${viewUser.role}-${viewUser.id}`}
                            token={token}
                            role={viewUser.role}
                            id={viewUser.id}
                            onBack={() => navigate(-1)}
                            onOpenUser={openUser}
                            onOpenTransactions={openTransactions}
                        />
                    ) : (
                        <UserDirectory key={searchParams.toString()} token={token} initial={Object.fromEntries(searchParams) as UserQuery} onOpenUser={openUser} />
                    )
                )}

                {activeTab === 'activity' && <ActivityLog token={token} onOpenUser={openUser} />}

                {activeTab === 'fund_requests' && (
                    <AdminFundRequests
                        requests={fundRequests}
                        busy={loadingFR}
                        onDecide={handleFundRequestStatus}
                        onOpenDistributor={(id) => openUser('distributor', id)}
                    />
                )}

                {/* The old distributors page lives on as Users → Distributors. */}
                {activeTab === 'distributors' && (
                    <UserDirectory token={token} initial={{ role: 'distributor' }} onOpenUser={openUser} />
                )}

                {activeTab === 'create' && (
                    <CreateRetailerWizard
                        kind="distributor"
                        formData={formData}
                        setFormData={(f) => setFormData(f as typeof formData)}
                        parentName="Admin"
                        merchantCode={merchantCode}
                        setMerchantCode={setMerchantCode}
                        isExistingMerchant={false}
                        setIsExistingMerchant={() => {}}
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
                        roleLabel="Admin"
                        code={profileData.adminId}
                        showNetwork={false}
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
                        isAadhaarLocked={false}
                        isPanLocked={false}
                        onViewNetwork={() => setActiveTab('dashboard')}
                    />
                )}
            </main>
        </div>
    );
};

export default AdminPortal;
