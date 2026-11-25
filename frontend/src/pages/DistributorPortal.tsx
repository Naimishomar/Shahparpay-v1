import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, FileText, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import EditRetailerModal from '../components/EditRetailerModal';
import NetworkDashboard, { type DirectoryPreset } from '../components/distributor/NetworkDashboard';
import RetailerDirectory from '../components/distributor/RetailerDirectory';
import RetailerDetail from '../components/distributor/RetailerDetail';
import CreateRetailerWizard from '../components/distributor/CreateRetailerWizard';
import DistributorProfile from '../components/distributor/DistributorProfile';
import { SERVICES } from '../lib/services';
import { BUTTON, BUTTON_QUIET, FIELD, ICON_BUTTON, TABLE, TD, TH, THEAD, TR, inr } from '../components/distributor/shared';
import { Empty, PageHeader, Panel, Segmented, StatusDot } from '../components/distributor/ui';

const DistributorPortal = () => {
    const { user, token, isInitializing } = useAuth();
    const navigate = useNavigate();
    const { tab } = useParams<{ tab: string }>();
    const activeTab = tab ? tab.replace('-', '_') : 'dashboard';
    const setActiveTab = (t: string) => navigate('/distributor/' + t);
    
    // Data states
    const [retailers, setRetailers] = useState<any[]>([]);
    const [fundRequests, setFundRequests] = useState<any[]>([]);
    const [myFundRequests, setMyFundRequests] = useState<any[]>([]);
    const [loadingFR, setLoadingFR] = useState(false);
    const [frSubTab, setFrSubTab] = useState<'incoming' | 'outgoing'>('incoming');
    const [showAddFrModal, setShowAddFrModal] = useState(false);
    const [frFormData, setFrFormData] = useState({ transactionMode: '', amount: '', bankUtr: '', depositDate: '', remarks: '' });
    const [frDepositSlip, setFrDepositSlip] = useState<File | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        prefix: 'Mr', firstName: '', lastName: '', email: '', contactNumber: '', password: '', 
        dob: '', city: '', landmark: '', district: '', state: '', 
        businessName: '', businessAddress: '', 
        aadhaarNumber: '', panNumber: '', hasGst: false, gstNumber: '',
        // Every service is on by default; the distributor switches off what they don't want.
        ...Object.fromEntries(SERVICES.map((svc) => [`svc_${svc.key}`, 'Yes'])),
        
        website: '', brandName: '', companyRegisterName: '', supportEmail: '', supportMobile: ''
    });
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
        data.append('merchantCode', merchantCode);

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
                            onServicesChanged={(patch) => {
                                setSelectedRetailer({ ...selectedRetailer, ...patch });
                                setRetailers((list) => list.map((r) => (r._id === selectedRetailer._id ? { ...r, ...patch } : r)));
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
                            onCreate={() => setActiveTab('create')}
                        />
                    )
                )}

                {/* Fund Requests Tab */}
                {activeTab === 'fund_requests' && (
                    <div className="flex w-full flex-col gap-6 animate-in fade-in duration-200">
                        <PageHeader
                            eyebrow="Network"
                            title="Fund requests"
                            description="Wallet top-ups your retailers ask you for, and the ones you ask the admin for."
                            actions={<>
                                <Segmented
                                    label="Fund request direction"
                                    value={frSubTab}
                                    onChange={setFrSubTab}
                                    options={[['incoming', `From retailers ${fundRequests.filter((r) => r.status === 'PENDING').length || ''}`.trim()], ['outgoing', 'To admin']] as const}
                                />
                                {frSubTab === 'outgoing' && (
                                    <button type="button" onClick={() => setShowAddFrModal(true)} className={BUTTON}>
                                        <Plus size={16} strokeWidth={1.75} /> Request funds
                                    </button>
                                )}
                            </>}
                        />

                        {frSubTab === 'incoming' && (
                            <Panel title="From your retailers" description="Approving credits the retailer's wallet from yours." flush>
                                <div className="overflow-x-auto">
                                    <table className={TABLE}>
                                        <thead>
                                            <tr className={THEAD}>
                                                <th className={TH}>Date</th>
                                                <th className={TH}>Retailer</th>
                                                <th className={`${TH} text-right`}>Amount</th>
                                                <th className={TH}>Mode and UTR</th>
                                                <th className={TH}>Receipt</th>
                                                <th className={TH}>Status</th>
                                                <th className={`${TH} text-right`}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fundRequests.length === 0 ? (
                                                <tr><td colSpan={7}><Empty>No fund requests yet.</Empty></td></tr>
                                            ) : (
                                                fundRequests.map((req) => (
                                                    <tr key={req._id} className={TR}>
                                                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{new Date(req.depositDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td className={TD}>
                                                            <p className="text-foreground">{req.retailerId?.firstName} {req.retailerId?.lastName}</p>
                                                            <p className="text-[12px] text-muted-foreground"><span className="lp-figure">{req.retailerId?.retailerId}</span>{req.retailerId?.businessName ? ` · ${req.retailerId.businessName}` : ''}</p>
                                                        </td>
                                                        <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(Number(req.amount) || 0)}</td>
                                                        <td className={TD}>
                                                            <p className="text-foreground">{req.transactionMode}</p>
                                                            <p className="lp-figure text-[12px] text-muted-foreground">{req.bankUtr}</p>
                                                        </td>
                                                        <td className={TD}>
                                                            {req.depositSlipUrl ? (
                                                                <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-foreground hover:underline">
                                                                    <FileText size={14} strokeWidth={1.75} /> View
                                                                </a>
                                                            ) : <span className="text-[13px] text-muted-foreground">None</span>}
                                                        </td>
                                                        <td className={TD}>
                                                            <StatusDot status={req.status} />
                                                            {req.adminRemarks && <p className="mt-1 max-w-[160px] truncate text-[12px] text-muted-foreground" title={req.adminRemarks}>{req.adminRemarks}</p>}
                                                        </td>
                                                        <td className={`${TD} text-right`}>
                                                            {req.status === 'PENDING' && (
                                                                <div className="inline-flex items-center gap-2">
                                                                    <button type="button" disabled={loadingFR} onClick={() => handleFundRequestStatus(req._id, 'REJECTED')} className={`${BUTTON_QUIET} h-8 px-3 text-[13px]`} title="Reject">
                                                                        Reject
                                                                    </button>
                                                                    <button type="button" disabled={loadingFR} onClick={() => handleFundRequestStatus(req._id, 'APPROVED')} className={`${BUTTON} h-8 px-3 text-[13px]`} title="Approve and credit wallet">
                                                                        <CheckCircle size={14} strokeWidth={1.75} /> Approve
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
                            </Panel>
                        )}

                        {frSubTab === 'outgoing' && (
                            <Panel title="Your requests to admin" flush>
                                <div className="overflow-x-auto">
                                    <table className={TABLE}>
                                        <thead>
                                            <tr className={THEAD}>
                                                <th className={TH}>Date</th>
                                                <th className={`${TH} text-right`}>Amount</th>
                                                <th className={TH}>Mode and UTR</th>
                                                <th className={TH}>Receipt</th>
                                                <th className={TH}>Remarks</th>
                                                <th className={TH}>Status</th>
                                                <th className={`${TH} text-right`}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {myFundRequests.length === 0 ? (
                                                <tr><td colSpan={7}><Empty>You haven't requested any funds yet.</Empty></td></tr>
                                            ) : (
                                                myFundRequests.map((req) => (
                                                    <tr key={req._id} className={TR}>
                                                        <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{new Date(req.depositDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                        <td className={`${TD} lp-figure text-right text-foreground`}>{inr.format(Number(req.amount) || 0)}</td>
                                                        <td className={TD}>
                                                            <p className="text-foreground">{req.transactionMode}</p>
                                                            <p className="lp-figure text-[12px] text-muted-foreground">{req.bankUtr}</p>
                                                        </td>
                                                        <td className={TD}>
                                                            {req.depositSlipUrl ? (
                                                                <a href={req.depositSlipUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-foreground hover:underline">
                                                                    <FileText size={14} strokeWidth={1.75} /> View
                                                                </a>
                                                            ) : <span className="text-[13px] text-muted-foreground">None</span>}
                                                        </td>
                                                        <td className={`${TD} max-w-[160px] truncate text-muted-foreground`} title={req.remarks}>{req.remarks || '—'}</td>
                                                        <td className={TD}>
                                                            <StatusDot status={req.status} />
                                                            {req.adminRemarks && <p className="mt-1 max-w-[160px] truncate text-[12px] text-muted-foreground" title={req.adminRemarks}>{req.adminRemarks}</p>}
                                                        </td>
                                                        <td className={`${TD} text-right`}>
                                                            {req.status === 'PENDING' && (
                                                                <button type="button" onClick={() => handleDeleteMyFundRequest(req._id)} className={ICON_BUTTON} title="Delete request" aria-label="Delete request">
                                                                    <Trash2 size={15} strokeWidth={1.75} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Panel>
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
                        aadhaarPicture={aadhaarPicture} setAadhaarPicture={setAadhaarPicture}
                        panPicture={panPicture} setPanPicture={setPanPicture}
                        profilePicture={profilePicture} setProfilePicture={setProfilePicture}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" onClick={() => setShowAddFrModal(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="fr-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl rounded-2xl border bg-card shadow-xl">
                        <div className="flex items-start justify-between gap-4 border-b px-6 py-5">
                            <div>
                                <h2 id="fr-title" className="lp-serif text-[30px] leading-[1.05] text-foreground">Request funds</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Tell the admin what you deposited; they credit your wallet once it checks out.</p>
                            </div>
                            <button type="button" onClick={() => setShowAddFrModal(false)} className="flex size-9 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateFrSubmit} className="p-6">
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-sm text-foreground">Transaction mode</span>
                                    <select
                                        required
                                        className={FIELD}
                                        value={frFormData.transactionMode}
                                        onChange={(e) => setFrFormData({...frFormData, transactionMode: e.target.value})}
                                    >
                                        <option value="">Select transaction mode</option>
                                        <option value="IMPS">IMPS</option>
                                        <option value="NEFT">NEFT</option>
                                        <option value="RTGS">RTGS</option>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash Deposit">Cash Deposit</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-sm text-foreground">Deposit amount</span>
                                    <input
                                        type="number"
                                        required min="1"
                                        placeholder="₹0"
                                        className={`${FIELD} lp-figure`}
                                        value={frFormData.amount}
                                        onChange={(e) => setFrFormData({...frFormData, amount: e.target.value})}
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-sm text-foreground">Bank UTR or reference ID</span>
                                    <input
                                        type="text"
                                        required
                                        placeholder="UTR number"
                                        className={`${FIELD} lp-figure`}
                                        value={frFormData.bankUtr}
                                        onChange={(e) => setFrFormData({...frFormData, bankUtr: e.target.value})}
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-sm text-foreground">Deposit date</span>
                                    <input
                                        type="date"
                                        required
                                        className={`${FIELD} dark:[color-scheme:dark]`}
                                        value={frFormData.depositDate}
                                        onChange={(e) => setFrFormData({...frFormData, depositDate: e.target.value})}
                                    />
                                </label>

                                <label className="space-y-1.5 md:col-span-2">
                                    <span className="text-sm text-foreground">Deposit slip <span className="text-muted-foreground">(optional)</span></span>
                                    <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        className={`${FIELD} py-1.5 file:mr-3 file:h-7 file:rounded-md file:border-0 file:bg-muted file:px-3 file:text-[13px] file:text-foreground`}
                                        onChange={(e) => setFrDepositSlip(e.target.files ? e.target.files[0] : null)}
                                    />
                                </label>

                                <label className="space-y-1.5 md:col-span-2">
                                    <span className="text-sm text-foreground">Remark <span className="text-muted-foreground">(optional)</span></span>
                                    <textarea
                                        rows={3}
                                        placeholder="Anything the admin should know"
                                        className={`${FIELD} h-auto resize-none py-2.5`}
                                        value={frFormData.remarks}
                                        onChange={(e) => setFrFormData({...frFormData, remarks: e.target.value})}
                                    />
                                </label>
                            </div>

                            <div className="mt-6 flex justify-end gap-2 border-t pt-5">
                                <button type="button" onClick={() => setShowAddFrModal(false)} className={BUTTON_QUIET}>Cancel</button>
                                <button type="submit" disabled={loadingFR} className={BUTTON}>
                                    {loadingFR ? 'Submitting…' : 'Submit request'}
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
