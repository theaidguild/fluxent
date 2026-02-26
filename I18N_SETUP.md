# Internationalization (i18n) Setup

This project now supports internationalization with two languages:
- **English (en-US)** - Default language
- **Portuguese - Brazil (pt-BR)**

## Setup Overview

### Dependencies Installed
- `i18next` - Internationalization framework
- `react-i18next` - React bindings for i18next
- `expo-localization` - Device locale detection

### Files Added

1. **src/i18n/i18n.ts** - Main i18n configuration
   - Initializes i18next with translation resources
   - Detects device language automatically
   - Supports en-US and pt-BR

2. **src/i18n/locales/en-US.json** - English translations
3. **src/i18n/locales/pt-BR.json** - Portuguese (Brazil) translations

### Integration Points

#### App.tsx
- Imports and initializes i18n module
- Uses `useTranslation()` hook to access translations
- Translates tab labels and app title

#### ChatView.tsx
- Uses `useTranslation()` hook
- Translates placeholder text and connection messages

#### SettingsView.tsx
- Uses `useTranslation()` and `i18n` object
- Language selector modal with en-US and pt-BR options
- Translates all settings labels and placeholder text
- Language changes are applied immediately across the app

### How to Use

#### In React Components
```tsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t, i18n } = useTranslation();
  
  // Use translations
  return <Text>{t('settings.language')}</Text>;
  
  // Change language
  i18n.changeLanguage('pt-BR');
}
```

#### Translation Key Structure
- `app.*` - App-level strings (title, etc.)
- `tabs.*` - Tab navigation labels
- `common.*` - Common action buttons (button, cancel, etc.)
- `status.*` - Status messages
- `chat.*` - Chat view strings
- `session.*` - Session view strings
- `settings.*` - Settings view strings
- `tools.*` - Tool-related strings

### Adding New Translations

1. Add the string to both translation files:
   - `src/i18n/locales/en-US.json`
   - `src/i18n/locales/pt-BR.json`

2. Use in components with the `t()` function:
   ```tsx
   <Text>{t('category.key')}</Text>
   ```

### Language Auto-Detection

The app automatically detects the device's language:
- If device language is Portuguese, defaults to pt-BR
- Otherwise defaults to en-US

Users can manually select their preferred language from the Settings tab.

### Features

✅ Automatic device language detection  
✅ Manual language selection in Settings  
✅ Immediate UI updates when language changes  
✅ Persistent language preference (handled by i18next)  
✅ All UI strings are translatable  
✅ Support for interpolation (e.g., `Remove "{{name}}"?`)
