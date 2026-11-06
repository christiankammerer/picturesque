// SPDX-License-Identifier: GPL-3.0-or-later
//
// The Templates tab (EDT-24): live thumbnails drawn by the renderer at the
// Post's ratio (TPL-07), with photo counts (TPL-12), in TPL-11 order.
// Clicking one applies it, keeping the placed photos (TPL-05, AUT-08).

import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RATIO_HEIGHT, slideCountOf, type AspectRatio, type Post } from '../../../shared/model/schema.ts';
import { render } from '../../../shared/render/render.ts';
import { switchLayout } from '../../../shared/templates/autofill.ts';
import { postFromTemplate, type BuiltInTemplate } from '../../../shared/templates/builtins.ts';
import { pickerSections } from '../../../shared/templates/picker.ts';
import { editProject, useEditor } from '../state/store.ts';

const THUMB_WIDTH = 220;

export function TemplatesPanel() {
  const { t } = useTranslation();
  const post = useEditor((s) => s.project?.post);
  const photoCount = useEditor((s) => (s.project ? s.project.panelOrder.length : 0));
  if (!post) return null;
  const slides = slideCountOf(post.layout);
  const sections = pickerSections(post.type, post.aspectRatio, slides, photoCount);
  const apply = (template: BuiltInTemplate) =>
    editProject((p) => {
      const ratio: AspectRatio = template.kind === 'story' ? '9:16' : p.post.aspectRatio;
      return { ...p, post: switchLayout(p.post, postFromTemplate(template, ratio, slides), p.photos) };
    });

  if (sections.every((s) => s.entries.length === 0)) return <p className="muted pad">{t('templates.none')}</p>;
  return (
    <div className="templates-panel" data-testid="templates-panel">
      {sections.map((section) => (
        <div key={section.kind}>
          {sections.length > 1 && <div className="section-label">{t(`templates.section.${section.kind}`)}</div>}
          <ul className="template-grid">
            {section.entries.map(({ template, photos }) => (
              <li key={template.id}>
                <button
                  type="button"
                  className={`template${post.sourceTemplate?.id === template.id ? ' current' : ''}`}
                  data-testid="template"
                  data-template-id={template.id}
                  onClick={() => apply(template)}
                >
                  <TemplateThumb template={template} aspectRatio={template.kind === 'story' ? '9:16' : post.aspectRatio} slides={slides} />
                  <span>{t(template.nameKey)}</span>
                  <span className="badge" aria-label={t('templates.photoCount', { count: photos })}>
                    {template.text ? t('templates.withText', { count: photos }) : photos}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TemplateThumb({ template, aspectRatio, slides }: { template: BuiltInTemplate; aspectRatio: AspectRatio; slides: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const post: Post = useMemo(() => postFromTemplate(template, aspectRatio, slides), [template, aspectRatio, slides]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const n = slideCountOf(post.layout);
    const scale = (THUMB_WIDTH * (window.devicePixelRatio || 1)) / n;
    c.width = Math.round(n * scale);
    c.height = Math.round(scale * RATIO_HEIGHT[aspectRatio]);
    const ctx = c.getContext('2d', { alpha: false });
    if (ctx) render(ctx, post, () => undefined, { scale, emptyCells: 'placeholder' });
  }, [post, aspectRatio]);
  return <canvas ref={canvas} aria-hidden="true" />;
}
