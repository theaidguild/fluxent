import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';

// Get the device's locale, but support only our available languages
const getInitialLanguage = () => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
  
  if (deviceLocale === 'pt') {
    return 'pt-BR';
  }
  
  return 'en-US';
};

const resources = {
  'en-US': {
    translation: enUS,
  },
  'pt-BR': {
    translation: ptBR,
  },
};

i18n
  .use(initReactI18next) // initialize the connector
  .init({
    resources,
    lng: getInitialLanguage(), // detect language from device
    fallbackLng: 'en-US',
    
    interpolation: {
      escapeValue: false, // React already prevents XSS
    },
  });

export default i18n;
