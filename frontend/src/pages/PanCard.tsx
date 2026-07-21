import React, { useState } from 'react';
import { CreditCard, User, Mail, CreditCard as CardIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const PanCard: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '1',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'Male',
        mode: 'E',
        email_id: ''
    });
    
    // State to hold the dynamic form for redirect
    const [redirectData, setRedirectData] = useState<{
        response_url: string;
        encdata: string;
    } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (formData.mode === 'E' && !formData.email_id) {
            toast.error("Email ID is required for Electronic PAN.");
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/api/pan/generate-url`,
                {
                    ...formData,
                    redirect_url: window.location.origin + '/dashboard'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (res.data.success) {
                toast.success("Redirecting to NSDL Portal...");
                // Set the redirect data which will trigger the hidden form submission
                setRedirectData({
                    response_url: res.data.data.response_url,
                    encdata: res.data.data.encdata
                });
            } else {
                toast.error(res.data.message || "Failed to generate PAN request.");
            }
        } catch (error: any) {
            console.error("PAN Error:", error);
            toast.error(error.response?.data?.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Automatically submit the form once redirect data is set
    React.useEffect(() => {
        if (redirectData) {
            const form = document.getElementById('nsdl-redirect-form') as HTMLFormElement;
            if (form) {
                form.submit();
            }
        }
    }, [redirectData]);

    return (
        <>
            <div className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 text-white">
                        <div className="flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-bold mb-2 flex items-center">
                                    <CardIcon className="mr-3 h-8 w-8" />
                                    NSDL PAN Card Services
                                </h1>
                                <p className="text-blue-100 opacity-90">Apply for a new Electronic or Physical PAN Card</p>
                            </div>
                            <div className="hidden sm:block opacity-20">
                                <CardIcon size={80} />
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="p-6 sm:p-10">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                                    <select
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        required
                                    >
                                        <option value="1">Mr / Shri</option>
                                        <option value="2">Mrs / Shrimati</option>
                                    </select>
                                </div>
                                
                                {/* Gender */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        required
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Transgender">Transgender</option>
                                    </select>
                                </div>

                                {/* First Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter first name"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Middle Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name <span className="text-gray-400 text-xs">(Optional)</span></label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            name="middle_name"
                                            value={formData.middle_name}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter middle name"
                                        />
                                    </div>
                                </div>

                                {/* Last Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter last name"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Mode */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">PAN Card Mode</label>
                                    <select
                                        name="mode"
                                        value={formData.mode}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        required
                                    >
                                        <option value="E">Electronic PAN (E-PAN)</option>
                                        <option value="P">Physical PAN</option>
                                    </select>
                                </div>

                                {/* Email ID */}
                                <div className={`${formData.mode === 'E' ? 'block' : 'hidden'}`}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="email"
                                            name="email_id"
                                            value={formData.email_id}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter customer email"
                                            required={formData.mode === 'E'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={loading || redirectData !== null}
                                    className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-md text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
                                >
                                    {loading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : redirectData !== null ? (
                                        "Redirecting..."
                                    ) : (
                                        <span className="flex items-center">
                                            <CreditCard className="mr-2 h-5 w-5" />
                                            Proceed to NSDL Application
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Hidden form for NSDL redirect via POST */}
                        {redirectData && (
                            <form 
                                id="nsdl-redirect-form" 
                                action={redirectData.response_url} 
                                method="POST" 
                                className="hidden"
                            >
                                <input type="hidden" name="encdata" value={redirectData.encdata} />
                            </form>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
};

export default PanCard;
