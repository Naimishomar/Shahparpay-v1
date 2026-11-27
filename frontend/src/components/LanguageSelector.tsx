import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/animate-ui/components/radix/dropdown-menu';

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

    // A submenu of the profile menu (animate-ui DropdownMenu): one radio item per language.
    return <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-3 rounded-xl px-3 py-2.5 font-medium">
            <Languages className="w-4 h-4 text-muted-foreground" />
            Language
            <span className="ml-auto text-xs text-muted-foreground">{languages.find(([code]) => code === language)?.[1]}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-80 overflow-y-auto rounded-xl">
            <DropdownMenuRadioGroup value={language} onValueChange={changeLanguage}>
                {languages.map(([code, label]) => <DropdownMenuRadioItem key={code} value={code}>{label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
    </DropdownMenuSub>;
};

export default LanguageSelector;
