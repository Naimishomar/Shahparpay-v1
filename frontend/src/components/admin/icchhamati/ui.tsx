import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ICON_BUTTON } from '../../distributor/shared';

export const Pager = ({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (p: number) => void }) => lastPage > 1 ? (
    <div className="flex items-center justify-between gap-2 border-t px-5 py-3 text-[13px]">
        <span className="text-muted-foreground">Page <span className="lp-figure">{page}</span> of <span className="lp-figure">{lastPage}</span></span>
        <div className="flex gap-2">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={ICON_BUTTON}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page >= lastPage} onClick={() => onPage(page + 1)} className={ICON_BUTTON}><ChevronRight size={16} /></button>
        </div>
    </div>
) : null;

/** A label and a value on one line, for detail cards. */
export const Fact = ({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) => (
    <div className="flex justify-between gap-4 border-b border-dashed py-2.5 text-sm last:border-0">
        <dt className="text-muted-foreground">{k}</dt>
        <dd className={`min-w-0 break-all text-right ${strong ? 'font-medium text-foreground' : 'text-foreground'}`}>{v}</dd>
    </div>
);
