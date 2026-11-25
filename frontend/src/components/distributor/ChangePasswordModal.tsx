import { useState } from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { BUTTON, BUTTON_QUIET, FIELD } from './shared';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl sm:p-7">
                <button onClick={onClose} className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                    <X size={18} />
                </button>

                <div className="mb-6 pr-10">
                    <p className="text-[13px] text-muted-foreground">Step {step} of 2</p>
                    <h2 id="change-password-title" className="lp-serif mt-1 text-[30px] leading-[1.05] text-foreground">Change password</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {step === 1 ? 'We will email a 6-digit code to confirm it is you.' : `Enter the code sent to ${maskEmail(email)} and your new password.`}
                    </p>
                </div>

                {step === 1 ? (
                    <div className="space-y-4">
                        <div className="flex h-10 items-center gap-3 rounded-[10px] border bg-muted/50 px-3.5">
                            <Mail size={16} className="shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm text-foreground">{maskEmail(email)}</span>
                        </div>
                        <button onClick={sendOtp} disabled={loading} className={`${BUTTON} w-full`}>
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {loading ? 'Sending…' : 'Send code'}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-foreground">Verification code</label>
                                <button type="button" onClick={sendOtp} disabled={loading} className="text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50">Resend</button>
                            </div>
                            <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="6-digit code"
                                autoFocus
                                className={`${FIELD} lp-figure tracking-[0.4em]`}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm text-foreground">New password</label>
                            <div className="relative">
                                <input
                                    type={show ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="new-password"
                                    placeholder={`At least ${MIN_LENGTH} characters`}
                                    className={`${FIELD} pr-16`}
                                />
                                <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground">
                                    {show ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {password.length > 0 && password.length < MIN_LENGTH && (
                                <p className="text-[13px] text-[var(--lp-danger)]">At least {MIN_LENGTH} characters</p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm text-foreground">Confirm new password</label>
                            <input
                                type={show ? 'text' : 'password'}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                autoComplete="new-password"
                                className={`${FIELD} ${mismatch ? 'border-[var(--lp-danger-line)]' : ''}`}
                            />
                            {mismatch && <p className="text-[13px] text-[var(--lp-danger)]">Passwords don't match</p>}
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setStep(1)} disabled={loading} className={BUTTON_QUIET}>Back</button>
                            <button type="submit" disabled={loading || !canSubmit} className={`${BUTTON} flex-1`}>
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
