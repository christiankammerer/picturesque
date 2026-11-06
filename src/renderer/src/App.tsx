// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

/** Placeholder shell. The start screen and workspace arrive in M2. */
export function App() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('app.name')}</h1>
      <p>{t('app.comingSoon')}</p>
    </main>
  );
}
