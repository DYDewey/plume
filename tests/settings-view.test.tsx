import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsView, Segmented, Switch } from '../src/renderer/src/components/settings-view';
import { isSendKey } from '../src/renderer/src/components/composer';
import { isSettingsShortcut } from '../src/renderer/src/ui-format';
import { DEFAULT_SETTINGS } from '../src/shared/settings';

const noop = () => {};

describe('SettingsView', () => {
  it('s’ouvre sur « Général » avec les 4 sections et un bouton fermer', () => {
    const html = renderToStaticMarkup(
      <SettingsView settings={DEFAULT_SETTINGS} router onChange={noop} onRouterChange={noop} onClose={noop} />,
    );
    for (const label of ['Général', 'Apparence', 'Claude', 'Raccourcis']) expect(html).toContain(label);
    expect(html).toContain('aria-label="Fermer les paramètres"');
    expect(html).toContain('Envoyer le message');
  });
});

describe('Segmented', () => {
  it('une seule option cochée, seule atteignable par Tab', () => {
    const html = renderToStaticMarkup(
      <Segmented label="Thème" value="dark" onChange={noop}
        options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />,
    );
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>Sombre/);
    expect(html).toMatch(/aria-checked="false" tabindex="-1"[^>]*>Clair/);
  });
});

describe('Switch', () => {
  it('rôle switch et état lisible', () => {
    expect(renderToStaticMarkup(<Switch label="X" checked onChange={noop} />)).toMatch(/role="switch" aria-checked="true"/);
  });
});

describe('touche d’envoi', () => {
  const k = (mods: Partial<KeyboardEvent> = {}) => ({ key: 'Enter', shiftKey: false, ctrlKey: false, ...mods });
  it('Entrée : Entrée seule envoie', () => {
    expect(isSendKey(k(), 'enter')).toBe(true);
    expect(isSendKey(k({ shiftKey: true }), 'enter')).toBe(false);
    expect(isSendKey(k({ ctrlKey: true }), 'enter')).toBe(false);
  });
  it('Ctrl+Entrée : seule la combinaison envoie', () => {
    expect(isSendKey(k({ ctrlKey: true }), 'ctrl-enter')).toBe(true);
    expect(isSendKey(k(), 'ctrl-enter')).toBe(false);
  });
});

describe('Ctrl+,', () => {
  it('ouvre les paramètres, rien d’autre', () => {
    const key = (k: string, ctrlKey: boolean) => ({ key: k, ctrlKey, shiftKey: false, altKey: false, metaKey: false });
    expect(isSettingsShortcut(key(',', true))).toBe(true);
    expect(isSettingsShortcut(key(',', false))).toBe(false);
    expect(isSettingsShortcut(key('b', true))).toBe(false);
  });
});
