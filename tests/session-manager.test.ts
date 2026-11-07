import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { SessionManager } from '../src/main/session-manager';
import type { BridgeEvent } from '../src/shared/events';

const fakeClaude = { command: process.execPath, prefixArgs: [join(__dirname, 'fixtures/fake-claude.cjs')] };

function waitFor(events: BridgeEvent[], type: BridgeEvent['type']): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`pas d'événement ${type}`)), 5000);
    const check = setInterval(() => {
      if (events.some((e) => e.type === type)) {
        clearInterval(check);
        clearTimeout(timer);
        resolve();
      }
    }, 20);
  });
}

describe('SessionManager', () => {
  it('envoie un message et reçoit la réponse en flux', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir());
    manager.send(id, 'bonjour');
    await waitFor(events, 'turn-end');

    expect(events.filter((e) => e.type === 'text-delta')).toEqual([{ type: 'text-delta', sessionId: id, text: 'bonjour' }]);
    manager.stopAll();
  });

  it('émet une erreur lisible si claude est introuvable', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), { command: 'claude-introuvable-xyz' });

    manager.start(tmpdir());
    await waitFor(events, 'error');

    expect(events[0]).toMatchObject({ type: 'error', message: expect.stringContaining('introuvable') });
  });

  it('interrupt termine le tour sans erreur et la session reste utilisable', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir());
    manager.interrupt(id);
    await waitFor(events, 'turn-end');
    expect(events.some((e) => e.type === 'error')).toBe(false);

    events.length = 0;
    manager.send(id, 'encore');
    await waitFor(events, 'text-delta');
    expect(manager.has(id)).toBe(true);
    manager.stopAll();
  });

  it('stop arrête le processus', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir());
    expect(manager.has(id)).toBe(true);
    manager.stop(id);
    expect(manager.has(id)).toBe(false);
  });

  it('restart relance la même session avec le nouveau modèle, sans erreur', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir(), undefined, 'opus');
    manager.send(id, 'bonjour');
    await waitFor(events, 'turn-end');
    events.length = 0;
    manager.restart(id, 'sonnet');
    manager.send(id, 'args?');
    await waitFor(events, 'turn-end');
    // Laisse à l'ancien processus le temps de signaler sa fin.
    await new Promise((r) => setTimeout(r, 300));

    const text = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
    expect(text).toContain(`--model sonnet --resume ${id}`);
    expect(text).not.toContain('opus');
    expect(events.some((e) => e.type === 'error')).toBe(false);
    expect(manager.has(id)).toBe(true);
    manager.stopAll();
  });

  it('restart sans modèle revient à « Par défaut » (pas de --model)', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir(), undefined, 'opus');
    manager.send(id, 'bonjour');
    await waitFor(events, 'turn-end');
    events.length = 0;
    manager.restart(id, undefined);
    manager.send(id, 'args?');
    await waitFor(events, 'turn-end');

    const text = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
    expect(text).not.toContain('--model');
    expect(text).toContain(`--resume ${id}`);
    manager.stopAll();
  });

  it('restart avant le 1er message garde le même id sans --resume (aucune conversation à reprendre)', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir());
    manager.restart(id, 'sonnet');
    manager.send(id, 'args?');
    await waitFor(events, 'turn-end');

    const text = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
    expect(text).toContain(`--model sonnet --session-id ${id}`);
    expect(text).not.toContain('--resume');
    manager.stopAll();
  });

  it('une copie reste une copie si on change de modèle avant le 1er message, puis reprend son propre fichier', async () => {
    const events: BridgeEvent[] = [];
    const manager = new SessionManager((e) => events.push(e), fakeClaude);

    const id = manager.start(tmpdir(), undefined, undefined, 'ancien');
    manager.restart(id, 'sonnet');
    manager.send(id, 'args?');
    await waitFor(events, 'turn-end');
    const text = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
    expect(text).toContain(`--resume ancien --fork-session --session-id ${id}`);

    events.length = 0;
    manager.restart(id, 'haiku');
    manager.send(id, 'args?');
    await waitFor(events, 'turn-end');
    const after = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
    expect(after).toContain(`--resume ${id}`);
    expect(after).not.toContain('--fork-session');
    manager.stopAll();
  });

  describe('permissions', () => {
    function askedManager() {
      const events: BridgeEvent[] = [];
      const manager = new SessionManager((e) => events.push(e), fakeClaude);
      const id = manager.start(tmpdir());
      return { events, manager, id };
    }
    const reply = (events: BridgeEvent[]) => events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');

    it('Autoriser renvoie la commande gardée par main, sans règle', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.answerPermission(id, 'req-1', 'allow');
      await waitFor(events, 'turn-end');
      const text = reply(events);
      expect(text).toContain('"behavior":"allow"');
      expect(text).toContain('"updatedInput":{"command":"curl example.com"}');
      expect(text).not.toContain('updatedPermissions');
      expect(events).toContainEqual({ type: 'permission-resolved', sessionId: id, requestId: 'req-1', decision: 'allow' });
      manager.stopAll();
    });

    it('Toujours autoriser écrit la règle dans le dossier de travail, jamais dans les réglages globaux', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.answerPermission(id, 'req-1', 'always');
      await waitFor(events, 'turn-end');
      const text = reply(events);
      expect(text).toContain('"updatedPermissions"');
      expect(text).toContain('"destination":"localSettings"');
      expect(text).not.toContain('userSettings');
      manager.stopAll();
    });

    it('Refuser envoie le message de refus', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.answerPermission(id, 'req-1', 'deny');
      await waitFor(events, 'turn-end');
      expect(reply(events)).toContain("Refusé par l'utilisateur");
      manager.stopAll();
    });

    it('ignore un identifiant inconnu et une deuxième réponse', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.answerPermission(id, 'autre', 'allow');
      expect(events.some((e) => e.type === 'permission-resolved')).toBe(false);
      manager.answerPermission(id, 'req-1', 'deny');
      manager.answerPermission(id, 'req-1', 'allow');
      await waitFor(events, 'turn-end');
      expect(events.filter((e) => e.type === 'permission-resolved')).toHaveLength(1);
      expect(reply(events)).not.toContain('"allow"');
      manager.stopAll();
    });

    it('Arrêter refuse la demande en attente', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.interrupt(id);
      await waitFor(events, 'turn-end');
      expect(events).toContainEqual({ type: 'permission-resolved', sessionId: id, requestId: 'req-1', decision: 'deny' });
      manager.stopAll();
    });

    it('fermer la session marque la demande refusée', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.stop(id);
      expect(events).toContainEqual({ type: 'permission-resolved', sessionId: id, requestId: 'req-1', decision: 'deny' });
    });

    it('claude annule sa demande : la carte se ferme', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'permission?');
      await waitFor(events, 'permission-request');
      manager.send(id, 'annule?');
      await waitFor(events, 'permission-resolved');
      manager.answerPermission(id, 'req-1', 'allow');
      await waitFor(events, 'turn-end');
      expect(reply(events)).toBe('');
      manager.stopAll();
    });

    it('un outil qui attend une vraie réponse ne fait pas de carte : Claude doit demander dans le chat', async () => {
      const { events, manager, id } = askedManager();
      manager.send(id, 'question?');
      await waitFor(events, 'turn-end');
      expect(events.some((e) => e.type === 'permission-request')).toBe(false);
      expect(reply(events)).toContain('Pose ta question');
      manager.stopAll();
    });
  });

  describe('instructions de projet (promptFor)', () => {
    const prompt = 'Instructions du projet « Été » :\nRéponds "court"\n\n- D:\\sujet.pdf';

    async function argsOf(manager: SessionManager, events: BridgeEvent[], id: string): Promise<string[]> {
      events.length = 0;
      manager.send(id, 'args-json?');
      await waitFor(events, 'turn-end');
      const text = events.filter((e) => e.type === 'text-delta').map((e) => (e as { text: string }).text).join('');
      return JSON.parse(text) as string[];
    }

    it('passe le texte intact, au lancement et après un changement de modèle', async () => {
      const events: BridgeEvent[] = [];
      const asked: string[] = [];
      const manager = new SessionManager((e) => events.push(e), {
        ...fakeClaude,
        promptFor: (cwd) => (asked.push(cwd), prompt),
      });

      const id = manager.start(tmpdir());
      let args = await argsOf(manager, events, id);
      expect(args[args.indexOf('--append-system-prompt') + 1]).toBe(prompt);

      manager.restart(id, 'sonnet');
      args = await argsOf(manager, events, id);
      await new Promise((r) => setTimeout(r, 300));
      expect(args[args.indexOf('--append-system-prompt') + 1]).toBe(prompt);
      expect(asked).toEqual([tmpdir(), tmpdir()]);
      manager.stopAll();
    });

    it('rien à envoyer : pas d option', async () => {
      const events: BridgeEvent[] = [];
      const manager = new SessionManager((e) => events.push(e), { ...fakeClaude, promptFor: () => null });

      const id = manager.start(tmpdir());
      expect(await argsOf(manager, events, id)).not.toContain('--append-system-prompt');
      manager.stopAll();
    });
  });
});
