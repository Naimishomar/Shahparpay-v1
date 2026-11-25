import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/** Switches the whole app between dark (the default) and light; next-themes remembers the choice. */
export default function ThemeToggle({ className = '' }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();
    const dark = resolvedTheme !== 'light';
    return (
        <button
            type="button"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            className={`lp-theme-toggle flex size-10 flex-none items-center justify-center rounded-lg text-[var(--lp-fg-2)] transition-colors hover:bg-[var(--lp-surface)] hover:text-[var(--lp-fg)] ${className}`}
        >
            {dark ? <Sun aria-hidden strokeWidth={1.5} className="size-[18px]" /> : <Moon aria-hidden strokeWidth={1.5} className="size-[18px]" />}
        </button>
    );
}
