import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PermissionCard } from '../src/renderer/src/components/permission-card';
import { createStreamParser } from '../src/main/stream-parser';
import { hasPendingPermission, initialState, sessionsReducer } from '../src/renderer/src/state/sessions';

const item = {
  kind: 'permission' as const,
  requestId: 'r1',
  toolName: 'Bash',
  input: { command: `curl ${'x'.repeat(200)}`, description: 'Télécharger' },
  description: 'Télécharger',
  rules: ['Bash(curl x)'],
};

describe('PermissionCard', () => {
  it('en attente : commande entière, description, trois boutons et la règle enregistrée', () => {
    const html = renderToStaticMarkup(<PermissionCard item={item} />);
    expect(html).toContain('x'.repeat(200));
    expect(html).toContain('Télécharger');
    for (const label of ['Autoriser', 'Toujours autoriser', 'Refuser', 'Bash(curl x)']) expect(html).toContain(label);
  });

  it('sans règle proposée : pas de « Toujours autoriser »', () => {
    const html = renderToStaticMarkup(<PermissionCard item={{ ...item, rules: [] }} />);
    expect(html).not.toContain('Toujours');
    expect(html).toContain('Autoriser');
  });

  it('répondue : une ligne réduite, plus de boutons', () => {
    const html = renderToStaticMarkup(<PermissionCard item={{ ...item, decision: 'deny' }} />);
    expect(html).toContain('refusé');
    expect(html).not.toContain('<button');
  });
});

describe('demandes dans le parseur', () => {
  const parse = (obj: unknown) => createStreamParser('s').push(JSON.stringify(obj) + '\n');

  it('can_use_tool devient une demande, avec des règles forcées vers le dossier de travail', () => {
    const [event] = parse({
      type: 'control_request',
      request_id: 'r1',
      request: {
        subtype: 'can_use_tool',
        tool_name: 'Bash',
        input: { command: 'ls' },
        description: 'Lister',
        permission_suggestions: [
          { type: 'addRules', behavior: 'allow', destination: 'userSettings', rules: [{ toolName: 'Bash', ruleContent: 'ls' }] },
          { type: 'setMode', mode: 'bypassPermissions', destination: 'userSettings' },
          { type: 'addRules', behavior: 'deny', destination: 'localSettings', rules: [{ toolName: 'Bash' }] },
        ],
      },
    });
    expect(event).toEqual({
      type: 'permission-request',
      sessionId: 's',
      requestId: 'r1',
      toolName: 'Bash',
      input: { command: 'ls' },
      description: 'Lister',
      suggestions: [{ type: 'addRules', behavior: 'allow', destination: 'localSettings', rules: [{ toolName: 'Bash', ruleContent: 'ls' }] }],
    });
  });

  it('ignore les autres control_request', () => {
    expect(parse({ type: 'control_request', request_id: 'r', request: { subtype: 'hook_callback' } })).toEqual([]);
  });
});

describe('demandes dans le reducer', () => {
  const opened = sessionsReducer(initialState, { type: 'session-opened', sessionId: 's', cwd: 'C:/d' });
  const asked = sessionsReducer(opened, {
    type: 'permission-request',
    sessionId: 's',
    requestId: 'r1',
    toolName: 'Bash',
    input: {},
    suggestions: [{ type: 'addRules', behavior: 'allow', destination: 'localSettings', rules: [{ toolName: 'Bash', ruleContent: 'ls' }, { toolName: 'Read' }] }],
  });

  it('ajoute une carte en attente, avec des règles lisibles', () => {
    expect(hasPendingPermission(asked.sessions[0])).toBe(true);
    expect(asked.sessions[0].items[0]).toMatchObject({ kind: 'permission', rules: ['Bash(ls)', 'Read'] });
  });

  it('la réponse ferme la carte', () => {
    const done = sessionsReducer(asked, { type: 'permission-resolved', sessionId: 's', requestId: 'r1', decision: 'allow' });
    expect(hasPendingPermission(done.sessions[0])).toBe(false);
    expect(done.sessions[0].items[0]).toMatchObject({ decision: 'allow' });
  });
});
