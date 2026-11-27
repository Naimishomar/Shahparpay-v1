import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from './animate-ui/primitives/radix/dialog';

/**
 * Every retailer modal: animate-ui's radix Dialog flips the panel in over a
 * blurred backdrop, traps focus and closes on Escape. `children` is the panel.
 * The caller mounts it only while open, so there is no exit animation.
 */
export default function PortalDialog({ label, onClose, closeOnOutside = false, children }: {
    label: string; onClose: () => void; closeOnOutside?: boolean; children: ReactNode;
}) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogPortal>
                <DialogOverlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
                <DialogContent
                    aria-describedby={undefined}
                    // A click beside a half-filled form must not throw it away.
                    onInteractOutside={(e) => e.preventDefault()}
                    onClick={closeOnOutside ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
                    className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 outline-none sm:items-center"
                >
                    <DialogTitle className="sr-only">{label}</DialogTitle>
                    {children}
                </DialogContent>
            </DialogPortal>
        </Dialog>
    );
}
