import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

declare global {
    interface Window { google?: any; googleTranslateElementInit?: () => void; }
}

const languages = [
    ['en', 'English'], ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['mr', 'मराठी'],
    ['gu', 'ગુજરાતી'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['kn', 'ಕನ್ನಡ'],
    ['ml', 'മലയാളം'], ['pa', 'ਪੰਜਾਬੀ'], ['or', 'ଓଡ଼ିଆ'],
];

/**
 * Google Translate's hidden widget. Kept mounted for the whole session (in the
 * header) so the picker can live in a dropdown that unmounts when closed —
 * the picker drives this widget's `.goog-te-combo`.
 */
export const TranslateHost = () => {
    useEffect(() => {
        const loadGoogleTranslate = () => {
            if (window.google?.translate?.TranslateElement) {
                new window.google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: languages.map(([code]) => code).join(','), autoDisplay: false }, 'google_translate_element');
                return;
            }
            window.googleTranslateElementInit = () => new window.google!.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: languages.map(([code]) => code).join(','), autoDisplay: false }, 'google_translate_element');
            if (!document.querySelector('script[data-google-translate]')) {
                const script = document.createElement('script');
                script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
                script.async = true;
                script.dataset.googleTranslate = 'true';
                document.body.appendChild(script);
            }
        };
        loadGoogleTranslate();
    }, []);

    return <div id="google_translate_element" className="hidden" />;
};

const LanguageSelector = () => {
    const [language, setLanguage] = useState(() => localStorage.getItem('app-language') || 'en');

    const changeLanguage = (value: string) => {
        setLanguage(value);
        localStorage.setItem('app-language', value);
        const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
        if (!select) return;
        select.value = value;
        select.dispatchEvent(new Event('change'));
    };

    return <label className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Language</span>
        <select aria-label="Translate application" value={language} onChange={(e) => changeLanguage(e.target.value)} className="ml-auto rounded-lg border bg-background px-2 py-1 text-sm text-foreground outline-none cursor-pointer">
            {languages.map(([code, label]) => <option key={code} value={code} className="bg-background text-foreground">{label}</option>)}
        </select>
    </label>;
};

export default LanguageSelector;
