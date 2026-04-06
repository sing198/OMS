import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import th from './locales/th.json';

// ดึงภาษาที่เคยเลือกไว้จาก LocalStorage (ถ้าไม่มีให้ใช้ 'en')
const savedLanguage = localStorage.getItem('language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      th: { translation: th }
    },
    lng: savedLanguage, // ภาษาเริ่มต้น
    fallbackLng: 'en',  // ถ้าหาคำแปลไม่เจอให้กลับไปใช้ภาษาอังกฤษ
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;