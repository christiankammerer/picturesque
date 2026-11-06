// SPDX-License-Identifier: GPL-3.0-or-later
//
// EDT-01: the start screen. Recent Projects and Open… arrive with Project
// files (M6).

import { useTranslation } from 'react-i18next';
import { newPost, type NewPostKind } from '../../../shared/model/post.ts';
import { emptyProject } from '../../../shared/model/project.ts';
import { clearLibrary } from '../state/library.ts';
import { setState } from '../state/store.ts';

export function startNew(kind: NewPostKind): void {
  clearLibrary();
  setState({
    screen: 'workspace',
    project: emptyProject(newPost(kind)),
    dirty: false,
    selectedCell: null,
    selectedSpacer: null,
    armedPhoto: null,
    sidebarTab: 'photos', // EDT-03
    notices: [],
  });
}

export function StartScreen() {
  const { t } = useTranslation();
  const kinds: { kind: NewPostKind; label: string; hint: string }[] = [
    { kind: 'collage', label: t('start.newCollage'), hint: t('start.collageHint') },
    { kind: 'carousel', label: t('start.newCarousel'), hint: t('start.carouselHint') },
    { kind: 'story', label: t('start.newStory'), hint: t('start.storyHint') },
  ];
  return (
    <main className="start-screen">
      <h1>{t('app.name')}</h1>
      <div className="start-choices">
        {kinds.map((k) => (
          <button key={k.kind} type="button" className="start-choice" onClick={() => startNew(k.kind)}>
            <span className="start-choice-label">{k.label}</span>
            <span className="muted">{k.hint}</span>
          </button>
        ))}
      </div>
      <button type="button" className="button" disabled title={t('start.openLater')}>
        {t('start.open')}
      </button>
    </main>
  );
}
