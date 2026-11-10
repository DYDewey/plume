import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HandoffButton } from '../src/renderer/src/components/handoff-button';
import { handoffPhase, shouldSuggestHandoff } from '../src/renderer/src/handoff-flow';
import { HandoffBanner } from '../src/renderer/src/components/handoff-banner';
import type { SessionState } from '../src/renderer/src/state/sessions';

const session = (patch: Partial<SessionState>): SessionState => ({
  id: 's1',
  cwd: 'C:\\proj',
  title: 'proj',
  items: [{ kind: 'user', text: 'bonjour' }, { kind: 'assistant', text: 'salut' }],
  status: 'idle',
  unread: false,
  ...patch,
});

describe('handoffPhase', () => {
  const pending = { sessionId: 's1', fromIndex: 2 };

  it('aucune passation, ou pour une autre session', () => {
    expect(handoffPhase(null, session({}))).toEqual({ phase: 'none' });
    expect(handoffPhase({ ...pending, sessionId: 's2' }, session({}))).toEqual({ phase: 'none' });
  });

  it('en cours tant que claude répond', () => {
    const items = [...session({}).items, { kind: 'user' as const, text: 'consigne' }];
    expect(handoffPhase(pending, session({ items, status: 'running' }))).toEqual({ phase: 'writing' });
  });

  it('prête quand le tour est fini avec un texte', () => {
    const items = [...session({}).items, { kind: 'user' as const, text: 'consigne' }, { kind: 'assistant' as const, text: '# Passation' }];
    expect(handoffPhase(pending, session({ items }))).toEqual({ phase: 'review', text: '# Passation' });
  });

  it('échouée quand le tour est fini sans texte ou avec une erreur', () => {
    const items = [...session({}).items, { kind: 'user' as const, text: 'consigne' }, { kind: 'error' as const, message: 'boum' }];
    expect(handoffPhase(pending, session({ items }))).toEqual({ phase: 'failed' });
  });
});

describe('HandoffButton', () => {
  it('actif quand la session est au repos avec des messages', () => {
    const html = renderToStaticMarkup(<HandoffButton session={session({})} phase="none" onClick={() => {}} />);
    expect(html).toContain('Passation');
    expect(html).not.toContain('disabled');
  });

  it('désactivé pendant une réponse ou sans message', () => {
    for (const s of [session({ status: 'running' }), session({ items: [] })]) {
      expect(renderToStaticMarkup(<HandoffButton session={s} phase="none" onClick={() => {}} />)).toContain('disabled');
    }
  });

  it('affiche la rédaction en cours, puis l\'échec', () => {
    const writing = renderToStaticMarkup(<HandoffButton session={session({ status: 'running' })} phase="writing" onClick={() => {}} />);
    expect(writing).toContain('Passation en cours');
    const failed = renderToStaticMarkup(<HandoffButton session={session({})} phase="failed" onClick={() => {}} />);
    expect(failed).toContain('Passation impossible');
  });
});

describe('shouldSuggestHandoff', () => {
  const on = { enabled: true, dismissed: false, phase: 'none' as const };
  const ctx = (used: number) => session({ context: { used, max: 1000 } });

  it('à partir du seuil, Claude au repos', () => {
    expect(shouldSuggestHandoff(ctx(700), 0.7, on)).toBe(true);
    expect(shouldSuggestHandoff(ctx(699), 0.7, on)).toBe(false);
  });

  it('jamais pendant une réponse, une passation, si refusée ou désactivée', () => {
    expect(shouldSuggestHandoff({ ...ctx(900), status: 'running' }, 0.7, on)).toBe(false);
    expect(shouldSuggestHandoff(ctx(900), 0.7, { ...on, phase: 'writing' })).toBe(false);
    expect(shouldSuggestHandoff(ctx(900), 0.7, { ...on, dismissed: true })).toBe(false);
    expect(shouldSuggestHandoff(ctx(900), 0.7, { ...on, enabled: false })).toBe(false);
  });

  it('contexte inconnu : rien', () => {
    expect(shouldSuggestHandoff(session({}), 0.7, on)).toBe(false);
  });
});

describe('HandoffBanner', () => {
  it('donne le pourcentage et le bouton', () => {
    const html = renderToStaticMarkup(<HandoffBanner percent={72} onHandoff={() => {}} onDismiss={() => {}} />);
    expect(html).toContain('Contexte à 72 %');
    expect(html).toContain('Faire la passation');
  });
});
