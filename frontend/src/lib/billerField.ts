/**
 * The one identifier a BBPS biller asks for, read from its own label.
 *
 * Icchhamati gives every biller a single `label` — "Consumer Number", "K Number",
 * "Vehicle Registered Number", "Card Last Four Digit", "Registered Contact
 * Number" — and that is the only input the biller takes besides the amount. So
 * the form shows exactly that field, named the biller's way, with the keyboard
 * and length the identifier needs.
 *
 * Keep in sync with app/src/screens/retailer/billerField.ts.
 */

export type BillerFieldKind = 'mobile' | 'last4' | 'vehicle' | 'text';

export interface BillerField {
    label: string;
    kind: BillerFieldKind;
    numeric: boolean;
    maxLength: number;
    placeholder: string;
}

const FALLBACK_LABEL = 'Consumer Number';

export const billerField = (biller?: { name?: string; label?: string | null } | null): BillerField => {
    const raw = String(biller?.label ?? '').trim();
    // A few billers ship their own name where the label belongs.
    const label = raw && raw.toLowerCase() !== String(biller?.name ?? '').trim().toLowerCase() ? raw : FALLBACK_LABEL;
    const l = label.toLowerCase();
    if (/mobile|contact number|^number$/.test(l)) {
        return { label, kind: 'mobile', numeric: true, maxLength: 10, placeholder: '10-digit mobile number' };
    }
    if (/last\s*(four|4)/.test(l)) {
        return { label, kind: 'last4', numeric: true, maxLength: 4, placeholder: 'Last 4 digits of the card' };
    }
    if (/vehicle/.test(l)) {
        return { label, kind: 'vehicle', numeric: false, maxLength: 15, placeholder: 'e.g. MH12AB1234' };
    }
    return { label, kind: 'text', numeric: false, maxLength: 40, placeholder: `Enter ${label}` };
};

/** What the retailer typed, as the biller will accept it. */
export const cleanBillerInput = (field: BillerField, value: string) => {
    if (field.numeric) return value.replace(/\D/g, '').slice(0, field.maxLength);
    if (field.kind === 'vehicle') return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, field.maxLength);
    return value.slice(0, field.maxLength);
};

export const billerInputValid = (field: BillerField, value: string) => {
    const v = value.trim();
    if (field.kind === 'mobile') return /^[6-9]\d{9}$/.test(v);
    if (field.kind === 'last4') return /^\d{4}$/.test(v);
    if (field.kind === 'vehicle') return v.length >= 6;
    return v.length >= 4;
};
