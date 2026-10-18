import { Link } from 'react-router-dom';
import LandingNav from '@/components/landing/LandingNav';
import LandingFooter from '@/components/landing/LandingFooter';

const NotFound = () => (
    <div className="landing-page relative overflow-x-clip bg-white text-slate-900">
        <LandingNav />
        <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-[#008c46]">404</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">Page not found</h1>
            <p className="mt-3 text-base text-slate-600">The page you are looking for does not exist or has moved.</p>
            <Link
                to="/"
                className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-[#18181b] px-6 text-sm font-bold text-white hover:bg-black"
            >
                Back to home
            </Link>
        </main>
        <LandingFooter />
    </div>
);

export default NotFound;
