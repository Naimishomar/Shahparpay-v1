import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isServiceEnabled, serviceLabel, type ServiceKey } from '../lib/services';

/**
 * Shows the page only if the service is on for this retailer. Hidden menu
 * items are not enough on their own: the page is still one typed URL away.
 */
const ServiceGate = ({ service, children }: { service: ServiceKey; children: React.ReactNode }) => {
    const { user } = useAuth();
    if (isServiceEnabled(user, service)) return <>{children}</>;
    return (
        <div className="flex w-full items-center justify-center py-16 animate-in fade-in duration-500">
            <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 w-fit rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-300 p-3 text-zinc-700 ring-1 ring-zinc-400/40 dark:from-zinc-600 dark:to-zinc-800 dark:text-zinc-100 dark:ring-zinc-400/30">
                    <Lock className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">{serviceLabel(service)} is not enabled</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    This service isn't switched on for your account. Please contact your distributor to enable it.
                </p>
                <Link to="/dashboard" className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md dark:bg-gradient-to-b dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 dark:text-zinc-900">
                    Back to dashboard
                </Link>
            </div>
        </div>
    );
};

export default ServiceGate;
