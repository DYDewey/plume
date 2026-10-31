import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResponderBadge } from '../src/renderer/src/components/router-toggle';
import { initialState, sessionsReducer } from '../src/renderer/src/state/sessions';

describe('ResponderBadge', () => {
  it('affiche le nom exact du modèle Claude, sans alerte', () => {
    const html = renderToStaticMarkup(<ResponderBadge responder={{ provider: 'Claude Code API', model: 'claude-haiku-5-5' }} />);
    expect(html).toContain('claude-haiku-5-5');
    expect(html).not.toContain('fallback');
  });

  it('signale le secours quand Gemini a répondu', () => {
    const html = renderToStaticMarkup(<ResponderBadge responder={{ provider: 'Google Gemini', model: 'gemini-3.5-flash' }} />);
    expect(html).toContain('Secours : gemini-3.5-flash');
    expect(html).toContain('fallback');
  });

  it('ne s\'affiche pas sans info', () => {
    expect(renderToStaticMarkup(<ResponderBadge />)).toBe('');
  });
});

describe('événement responder', () => {
  it('est retenu dans la session', () => {
    const opened = sessionsReducer(initialState, { type: 'session-opened', sessionId: 's1', cwd: 'C:/x' });
    const next = sessionsReducer(opened, { type: 'responder', sessionId: 's1', provider: 'Google Gemini', model: 'gemini-3.8-flash' });
    expect(next.sessions[0].responder).toEqual({ provider: 'Google Gemini', model: 'gemini-3.8-flash' });
  });
});
