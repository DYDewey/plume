import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModelPicker, pickerLabel } from '../src/renderer/src/components/model-picker';
import { launchModel, readLastModel } from '../src/renderer/src/model-choice';
import { initialState, sessionsReducer } from '../src/renderer/src/state/sessions';

const route = { model: 'opus' as const, reason: 'code collé', source: 'règles' as const };

describe('mode Auto : interface', () => {
  it('« auto » est retenu et lance Sonnet en attendant le 1er message', () => {
    expect(readLastModel({ getItem: () => 'auto' })).toBe('auto');
    expect(launchModel('auto')).toBe('sonnet');
    expect(launchModel('haiku')).toBe('haiku');
    expect(launchModel(undefined)).toBeUndefined();
  });

  it('bouton « Auto · Opus » et raison dans le menu', () => {
    expect(pickerLabel('auto', 'opus')).toBe('Auto · Opus');
    expect(pickerLabel('auto')).toBe('Auto');
    expect(pickerLabel(undefined)).toBe('Par défaut');
    const html = renderToStaticMarkup(<ModelPicker value="auto" autoModel="opus" route={route} disabled={false} onChange={() => {}} initialOpen />);
    expect(html).toContain('Auto · Opus');
    expect(html).toContain('code collé');
  });

  it('reducer : ouverture en Auto, choix retenu, retour au manuel', () => {
    let s = sessionsReducer(initialState, { type: 'session-opened', sessionId: 'a', cwd: 'C:/x', model: 'auto' });
    expect(s.sessions[0]).toMatchObject({ auto: true, model: 'sonnet' });
    s = sessionsReducer(s, { type: 'routed', sessionId: 'a', route });
    s = sessionsReducer(s, { type: 'model-changed', sessionId: 'a', model: 'opus', auto: true });
    expect(s.sessions[0]).toMatchObject({ auto: true, model: 'opus', route });
    s = sessionsReducer(s, { type: 'model-changed', sessionId: 'a', model: 'haiku' });
    expect(s.sessions[0]).toMatchObject({ auto: false, model: 'haiku', route: undefined });
  });
});
