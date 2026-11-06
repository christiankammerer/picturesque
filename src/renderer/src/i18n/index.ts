// SPDX-License-Identifier: GPL-3.0-or-later
//
// OVR-05: the one i18n layer. Every user-facing string comes from a message
// catalogue; English is the only one in v1. Adding a language means adding a
// catalogue here, with no other code changes.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

export const resources = { en: { translation: en } } as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
});

export default i18n;
