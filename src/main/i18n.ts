// SPDX-License-Identifier: GPL-3.0-or-later
//
// OVR-05 in the main process: native menus and dialogs use the same
// message catalogue as the renderer.

import i18next from 'i18next';
import en from '../renderer/src/i18n/locales/en.json';

export const i18n = i18next.createInstance();
void i18n.init({ resources: { en: { translation: en } }, lng: 'en', fallbackLng: 'en', initAsync: false });
export const t = i18n.t.bind(i18n);
