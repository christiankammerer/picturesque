// SPDX-License-Identifier: GPL-3.0-or-later
//
// Short messages: refused imports (OVR-04, PRF-05) and export results.

import { useTranslation } from 'react-i18next';
import { dismissNotice, useEditor, type Notice } from '../state/store.ts';

export function Notices() {
  const { t } = useTranslation();
  const notices = useEditor((s) => s.notices);
  if (notices.length === 0) return null;
  const text = (n: Notice) => {
    switch (n.key) {
      case 'import.unsupported':
      case 'import.tooLarge':
      case 'import.unreadable':
        return t(n.key, { name: n.name });
      case 'import.overLimit':
      case 'export.done':
        return t(n.key, { count: n.count });
      case 'export.failed':
        return t(n.key, { message: n.message });
    }
  };
  return (
    <div className="notices" role="status">
      {notices.map((n) => (
        <div key={n.id} className="notice" data-testid="notice">
          <span>{text(n)}</span>
          <button type="button" className="icon-button" aria-label={t('notice.dismiss')} onClick={() => dismissNotice(n.id)}>
            {t('notice.close')}
          </button>
        </div>
      ))}
    </div>
  );
}
