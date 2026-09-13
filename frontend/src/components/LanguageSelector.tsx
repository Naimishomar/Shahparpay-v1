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

const LanguageSelector = () => {
    const [language, setLanguage] = useState(() => localStorage.getItem('app-language') || 'en');

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

    const changeLanguage = (value: string) => {
        setLanguage(value);
        localStorage.setItem('app-language', value);
        const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
        if (!select) return;
        select.value = value;
        select.dispatchEvent(new Event('change'));
    };

    return <div className="flex items-center gap-2">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <select aria-label="Translate application" value={language} onChange={(e) => changeLanguage(e.target.value)} className="max-w-[110px] bg-transparent text-sm text-foreground outline-none cursor-pointer">
            {languages.map(([code, label]) => <option key={code} value={code} className="bg-background text-foreground">{label}</option>)}
        </select>
        <div id="google_translate_element" className="hidden" />
    </div>;
};

export default LanguageSelector;
