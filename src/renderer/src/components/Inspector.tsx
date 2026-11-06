// SPDX-License-Identifier: GPL-3.0-or-later
//
// The right inspector (EDT-04): Layout style (EDT-17) always, then the
// selected Cell's framing (EDT-15) and Layout controls (EDT-16), or the
// selected Spacer's.

import { useTranslation } from 'react-i18next';
import { canSplit, mergeCell, mergeSides, pathOfCell, setLeafKind, splitCell, type MergeSide } from '../../../shared/model/layout-ops.ts';
import { emptyCell, findCell, resetFraming, rotateCell, setFraming, type Project } from '../../../shared/model/project.ts';
import type { Layout, LayoutStyle } from '../../../shared/model/schema.ts';
import { clampFocus, MAX_ZOOM, MIN_ZOOM } from '../../../shared/render/framing.ts';
import { cellInnerRect } from '../../../shared/render/render.ts';
import { matchingPreset, STYLE_PRESETS } from '../../../shared/templates/presets.ts';
import { preview } from '../state/library.ts';
import { editProject, setState, useEditor } from '../state/store.ts';

const MERGE_SIDES: readonly MergeSide[] = ['left', 'right', 'up', 'down'];
const SPLIT_DIRECTIONS = ['row', 'column'] as const;
/** MOD-20 ranges, as fractions of the Slide width. */
const STYLE_SLIDERS = [
  { key: 'gap', max: 0.15 },
  { key: 'cornerRadius', max: 0.15 },
  { key: 'borderWidth', max: 0.05 },
] as const;

const withLayout = (p: Project, layout: Layout): Project => (layout === p.post.layout ? p : { ...p, post: { ...p.post, layout } });

export function Inspector() {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const selected = useEditor((s) => s.selectedCell);
  const spacer = useEditor((s) => s.selectedSpacer);
  const cell = project && selected ? findCell(project.post.layout, selected) : undefined;

  return (
    <aside className="inspector" aria-label={t('inspector.label')}>
      <StyleControls />
      {cell && (
        <section data-testid="cell-inspector">
          <h2>{t('inspector.cell')}</h2>
          {cell.photo ? <FramingControls cellId={cell.id} /> : <p className="muted">{t('inspector.emptyCellHint')}</p>}
          <LayoutControls cellId={cell.id} />
        </section>
      )}
      {!cell && spacer && (
        <section>
          <h2>{t('inspector.spacer')}</h2>
          <button
            type="button"
            className="button"
            onClick={() => {
              editProject((p) => withLayout(p, setLeafKind(p.post.layout, spacer, 'cell')));
              setState({ selectedSpacer: null });
            }}
          >
            {t('inspector.makeCell')}
          </button>
        </section>
      )}
      {!cell && !spacer && <p className="muted">{t('inspector.nothingSelected')}</p>}
    </aside>
  );
}

/** EDT-17: Style Presets, then every value editable. */
function StyleControls() {
  const { t } = useTranslation();
  const style = useEditor((s) => s.project?.post.style);
  if (!style) return null;
  const active = matchingPreset(style);
  const set = (patch: Partial<LayoutStyle>) => editProject((p) => ({ ...p, post: { ...p.post, style: { ...p.post.style, ...patch } } }));
  const slider = (key: 'gap' | 'cornerRadius' | 'borderWidth', max: number) => (
    <label key={key} className="field">
      <span>{t(`style.${key}`)}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={0.001}
        value={style[key]}
        data-testid={`style-${key}`}
        onChange={(e) => set({ [key]: Number(e.currentTarget.value) })}
      />
    </label>
  );
  return (
    <section>
      <h2>{t('style.title')}</h2>
      <div className="presets" role="group" aria-label={t('style.presets')}>
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset${active === p.id ? ' active' : ''}`}
            aria-pressed={active === p.id}
            data-testid={`preset-${p.id}`}
            onClick={() => set(p.style)}
          >
            <span className="preset-swatch" style={{ background: p.style.background, padding: Math.round(p.style.gap * 60) }}>
              <span style={{ borderRadius: p.style.cornerRadius * 60 }} />
            </span>
            {t(`presets.${p.id}`)}
          </button>
        ))}
      </div>
      {STYLE_SLIDERS.map(({ key, max }) => slider(key, max))}
      <div className="colour-row">
        <label className="field inline">
          <span>{t('style.borderColor')}</span>
          <input type="color" value={style.borderColor} data-testid="style-borderColor" onChange={(e) => set({ borderColor: e.currentTarget.value.toLowerCase() })} />
        </label>
        <label className="field inline">
          <span>{t('style.background')}</span>
          <input type="color" value={style.background} data-testid="style-background" onChange={(e) => set({ background: e.currentTarget.value.toLowerCase() })} />
        </label>
      </div>
    </section>
  );
}

function FramingControls({ cellId }: { cellId: string }) {
  const { t } = useTranslation();
  const project = useEditor((s) => s.project);
  const cell = project ? findCell(project.post.layout, cellId) : undefined;
  if (!cell?.photo) return null;
  const framing = cell.photo.framing;
  const photoId = cell.photo.photoId;

  /** Straighten re-covers the Cell (RND-07); keep the stored focus in range too. */
  const setStraighten = (straighten: number) => {
    const bmp = preview(photoId);
    editProject((p) => {
      const c = findCell(p.post.layout, cellId);
      if (!c?.photo) return p;
      const next = { ...c.photo.framing, straighten };
      const rect = cellInnerRect(p.post, cellId, 1000);
      return setFraming(p, cellId, bmp && rect && rect.w > 0 && rect.h > 0 ? clampFocus(rect, bmp.width, bmp.height, next) : next);
    });
  };

  return (
    <div className="controls">
      <label className="field">
        <span>{t('inspector.zoom')}</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          data-testid="zoom"
          onChange={(e) => editProject((p) => setFraming(p, cellId, { ...framing, zoom: Number(e.currentTarget.value) }))}
        />
      </label>
      <label className="field">
        <span>{t('inspector.straighten')}</span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.1}
          value={framing.straighten}
          data-testid="straighten"
          onChange={(e) => setStraighten(Number(e.currentTarget.value))}
        />
        <output>{t('inspector.degrees', { value: framing.straighten.toFixed(1) })}</output>
      </label>
      <div className="button-row">
        <button type="button" className="button" onClick={() => editProject((p) => rotateCell(p, cellId))}>
          {t('inspector.rotate')}
        </button>
        <button type="button" className="button" onClick={() => editProject((p) => resetFraming(p, cellId))}>
          {t('inspector.resetFraming')}
        </button>
        <button type="button" className="button" onClick={() => editProject((p) => emptyCell(p, cellId))}>
          {t('inspector.emptyCell')}
        </button>
      </div>
    </div>
  );
}

/** EDT-16: split, merge (valid sides only) and Make Spacer. */
function LayoutControls({ cellId }: { cellId: string }) {
  const { t } = useTranslation();
  const layout = useEditor((s) => s.project?.post.layout);
  if (!layout) return null;
  const sides = mergeSides(layout, cellId);
  return (
    <div className="controls layout-controls">
      <h3>{t('inspector.layout')}</h3>
      <div className="button-row">
        {SPLIT_DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            className="button"
            disabled={!canSplit(layout, cellId, dir)}
            onClick={() => editProject((p) => withLayout(p, splitCell(p.post.layout, cellId, dir)))}
          >
            {t(`inspector.split.${dir}`)}
          </button>
        ))}
      </div>
      {sides.length > 0 && (
        <div className="button-row" role="group" aria-label={t('inspector.merge')}>
          <span className="muted">{t('inspector.merge')}</span>
          {MERGE_SIDES.filter((s) => sides.includes(s)).map((side) => (
            <button key={side} type="button" className="button" onClick={() => editProject((p) => withLayout(p, mergeCell(p.post.layout, cellId, side)))}>
              {t(`inspector.mergeSide.${side}`)}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="button"
        onClick={() => {
          editProject((p) => {
            const path = pathOfCell(p.post.layout, cellId);
            return path ? withLayout(p, setLeafKind(p.post.layout, path, 'spacer')) : p;
          });
          setState({ selectedCell: null });
        }}
      >
        {t('inspector.makeSpacer')}
      </button>
    </div>
  );
}
