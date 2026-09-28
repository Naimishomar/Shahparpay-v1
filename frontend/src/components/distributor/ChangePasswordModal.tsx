import { useState } from 'react';
import { KeyRound, Loader2, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, SILVER_TILE } from './shared';

const MIN_LENGTH = 6;

const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(name.length - 2, 5)))}@${domain}`;
};

/**
 * Two steps, same endpoints as the retailer profile: an OTP to the address on
 * the account (the server reads it from the token), then OTP + new password.
 */
const ChangePasswordModal = ({ token, email, onClose }: { token: string | null; email: string; onClose: () => void }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const request = (path: string, method: string, body?: object) =>
        fetch(`${import.meta.env.VITE_BACKEND_URL}${path}`, {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: body ? JSON.stringify(body) : undefined,
        }).then((res) => res.json());

    const sendOtp = async () => {
        setLoading(true);
        try {
            const data = await request('/api/auth/send-password-otp', 'POST');
            if (data.success) {
                toast.success('Code sent to your email');
                setStep(2);
            } else toast.error(data.message || 'Could not send the code');
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const mismatch = confirm.length > 0 && confirm !== password;
    const canSubmit = otp.length === 6 && password.length >= MIN_LENGTH && password === confirm;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        try {
            const data = await request('/api/auth/change-password', 'PUT', { email, otp, newPassword: password });
            if (data.success) {
                toast.success('Password changed successfully');
                onClose();
            } else toast.error(data.message || 'Could not change the password');
        } catch {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-2xl sm:p-8">
                <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close">
                    <X size={18} />
                </button>

                <div className="mb-6 flex flex-col items-center text-center">
                    <div className={`mb-4 rounded-2xl p-3 ${SILVER_TILE}`}><KeyRound className="h-6 w-6" /></div>
                    <h2 id="change-password-title" className="text-xl font-bold tracking-tight">Change password</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {step === 1 ? 'We will email a 6-digit code to confirm it is you.' : `Enter the code sent to ${maskEmail(email)} and your new password.`}
                    </p>
                    <div className="mt-4 flex gap-1.5" aria-hidden>
                        {[1, 2].map((s) => <span key={s} className={`h-1.5 w-8 rounded-full ${s <= step ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-black/10 dark:bg-white/10'}`} />)}
                    </div>
                </div>

                {step === 1 ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-xl border bg-background p-3">
                            <Mail size={16} className="shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm font-medium">{maskEmail(email)}</span>
                        </div>
                        <button onClick={sendOtp} disabled={loading} className={`${PRIMARY_BUTTON} w-full py-3`}>
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Sending…' : 'Send code'}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Verification code</label>
                                <button type="button" onClick={sendOtp} disabled={loading} className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">Resend</button>
                            </div>
                            <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="6-digit code"
                                autoFocus
                                className={`${INPUT} font-mono tracking-[0.4em]`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">New password</label>
                            <div className="relative">
                                <input
                                    type={show ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    placeholder={`At least ${MIN_LENGTH} characters`}
                                    className={`${INPUT} pr-16`}
                                />
                                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                                    {show ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {password.length > 0 && password.length < MIN_LENGTH && (
                                <p className="text-xs text-red-600 dark:text-red-400">At least {MIN_LENGTH} characters</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Confirm new password</label>
                            <input
                                type={show ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                autoComplete="new-password"
                                className={`${INPUT} ${mismatch ? 'border-red-500/60' : ''}`}
                            />
                            {mismatch && <p className="text-xs text-red-600 dark:text-red-400">Passwords don't match</p>}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setStep(1)} disabled={loading} className={`${SECONDARY_BUTTON} justify-center`}>Back</button>
                            <button type="submit" disabled={loading || !canSubmit} className={`${PRIMARY_BUTTON} flex-1 py-3`}>
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? 'Updating…' : 'Change password'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ChangePasswordModal;
