// Nova-3 general language catalog, verified 2026-10-07 against:
// https://developers.deepgram.com/docs/models-languages-overview
// Deepgram expanded its hosted multilingual mode to 55 languages on 2026-10-23.
const groups = [
    ['Afrikaans', 'af af-ZA'],
    ['Arabic', 'ar ar-AE ar-SA ar-QA ar-KW ar-SY ar-LB ar-PS ar-JO ar-EG ar-SD ar-TD ar-MA ar-DZ ar-TN ar-IQ ar-IR'],
    ['Armenian', 'hy'], ['Assamese', 'as as-IN'], ['Belarusian', 'be'],
    ['Bengali', 'bn'], ['Bosnian', 'bs'], ['Bulgarian', 'bg'], ['Catalan', 'ca'],
    ['Chinese (Cantonese, Traditional)', 'zh-HK'],
    ['Chinese (Mandarin, Simplified)', 'zh zh-CN zh-Hans'],
    ['Chinese (Mandarin, Traditional)', 'zh-TW zh-Hant'],
    ['Croatian', 'hr'], ['Czech', 'cs cs-CZ'], ['Danish', 'da da-DK'], ['Dutch', 'nl'],
    ['English', 'en en-US en-AU en-GB en-IN en-NZ'], ['Estonian', 'et'], ['Finnish', 'fi'],
    ['Flemish', 'nl-BE'], ['French', 'fr fr-CA'], ['Georgian', 'ka ka-GE'],
    ['German', 'de'], ['German (Switzerland)', 'de-CH'], ['Greek', 'el'],
    ['Gujarati', 'gu'], ['Hebrew', 'he'], ['Hindi', 'hi'], ['Hungarian', 'hu'],
    ['Indonesian', 'id'], ['Italian', 'it'], ['Japanese', 'ja'], ['Kannada', 'kn'],
    ['Kazakh', 'kk kk-KZ'], ['Korean', 'ko ko-KR'], ['Latvian', 'lv'], ['Lithuanian', 'lt'],
    ['Macedonian', 'mk'], ['Malay', 'ms'], ['Marathi', 'mr'], ['Mongolian', 'mn'],
    ['Nepali', 'ne'], ['Norwegian', 'no'], ['Pashto', 'ps ps-AF'], ['Persian', 'fa'],
    ['Polish', 'pl'], ['Portuguese', 'pt pt-BR pt-PT'], ['Punjabi', 'pa pa-IN'],
    ['Romanian', 'ro'], ['Russian', 'ru'], ['Serbian', 'sr'], ['Slovak', 'sk'],
    ['Slovenian', 'sl'], ['Spanish', 'es es-419'], ['Swedish', 'sv sv-SE'],
    ['Tagalog', 'tl'], ['Tamil', 'ta'], ['Telugu', 'te'], ['Thai', 'th th-TH'],
    ['Turkish', 'tr tr-TR'], ['Ukrainian', 'uk'], ['Urdu', 'ur'], ['Vietnamese', 'vi'],
];
const STT_LANGUAGES = [
    { id: 'multi', label: 'Multilingual (Nova-3: 55 languages)' },
    ...groups.flatMap(([name, codes]) => codes.split(' ').map(id => ({ id, label: `${name} — ${id}` }))),
];
const ids = new Set(STT_LANGUAGES.map(option => option.id));
const isSttLanguage = value => ids.has(value);
const normalizeSttLanguage = value => isSttLanguage(value) ? value : 'multi';

module.exports = { STT_LANGUAGES, isSttLanguage, normalizeSttLanguage };
