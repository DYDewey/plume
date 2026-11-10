import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatView, isFindShortcut } from '../src/renderer/src/components/chat-view';
import type { ChatItem } from '../src/shared/chat-item';
import { lastUserText } from '../src/renderer/src/state/sessions';

const items: ChatItem[] = [
  { kind: 'user', text: 'premier' },
  { kind: 'assistant', text: 'réponse' },
  { kind: 'user', text: 'second' },
  { kind: 'error', message: 'coupé' },
];

describe('Réessayer', () => {
  it('sous le dernier élément quand Claude est au repos', () => {
    const html = renderToStaticMarkup(<ChatView items={items} running={false} onRetry={() => {}} />);
    expect(html).toContain('Réessayer');
    expect(html.indexOf('Réessayer')).toBeGreaterThan(html.indexOf('coupé'));
  });

  it('absent pendant une réponse, sans onRetry, ou si le dernier message attend sa réponse', () => {
    expect(renderToStaticMarkup(<ChatView items={items} running onRetry={() => {}} />)).not.toContain('Réessayer');
    expect(renderToStaticMarkup(<ChatView items={items} running={false} />)).not.toContain('Réessayer');
    expect(renderToStaticMarkup(<ChatView items={items.slice(0, 3)} running={false} onRetry={() => {}} />)).not.toContain('Réessayer');
  });

  it('renvoie le dernier message de l’utilisateur', () => {
    expect(lastUserText(items)).toBe('second');
    expect(lastUserText([])).toBeNull();
  });
});

describe('Ctrl+F', () => {
  it('seulement Ctrl+F', () => {
    const k = { key: 'f', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
    expect(isFindShortcut(k)).toBe(true);
    expect(isFindShortcut({ ...k, shiftKey: true })).toBe(false);
  });
});
