import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../src/renderer/src/components/sidebar';
import { isSidebarToggle, readCollapsed, writeCollapsed } from '../src/renderer/src/ui-format';
import type { SessionState } from '../src/renderer/src/state/sessions';

const noop = () => {};
const session = { id: 'a', title: 'Ma session', cwd: 'C:\\proj', status: 'running', items: [] } as unknown as SessionState;
const render = (collapsed: boolean) =>
  renderToStaticMarkup(
    <Sidebar sessions={[session]} activeId="a" onNew={noop} onSelect={noop} onClose={noop} collapsed={collapsed} onToggle={noop}>
      <section id="historique" />
    </Sidebar>,
  );

describe('Sidebar', () => {
  it('dépliée : section « Ouvertes », session qui répond marquée, historique et bouton pour replier', () => {
    const html = render(false);
    expect(html).toContain('Ouvertes');
    expect(html).toContain('Ma session');
    expect(html).toContain('class="indicator running"');
    expect(html).toContain('id="historique"');
    expect(html).toMatch(/aria-label="Replier la barre latérale"[^>]*aria-expanded="true"|aria-expanded="true"[^>]*aria-label="Replier la barre latérale"/);
  });

  it('repliée : seulement les boutons déplier et nouvelle session', () => {
    const html = render(true);
    expect(html).toContain('class="sidebar collapsed"');
    expect(html).toContain('aria-label="Déplier la barre latérale"');
    expect(html).toContain('aria-label="Nouvelle conversation"');
    expect(html).not.toContain('Ma session');
    expect(html).not.toContain('id="historique"');
  });
});

describe('Ctrl+B', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });

  it('reconnaît Ctrl+B (majuscule ou minuscule) seul', () => {
    expect(isSidebarToggle(key('b', { ctrlKey: true }))).toBe(true);
    expect(isSidebarToggle(key('B', { ctrlKey: true }))).toBe(true);
  });

  it('ignore B seul et les autres combinaisons', () => {
    expect(isSidebarToggle(key('b'))).toBe(false);
    expect(isSidebarToggle(key('b', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isSidebarToggle(key('v', { ctrlKey: true }))).toBe(false);
  });
});

describe('état replié retenu', () => {
  it('relit ce qui a été écrit, dépliée par défaut', () => {
    const data: Record<string, string> = {};
    const storage = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
    expect(readCollapsed(storage)).toBe(false);
    writeCollapsed(storage, true);
    expect(readCollapsed(storage)).toBe(true);
    writeCollapsed(storage, false);
    expect(readCollapsed(storage)).toBe(false);
  });
});
