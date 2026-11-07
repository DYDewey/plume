import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRouterChooser, DIRECT, loadRouterEnabled, readRouterToken, routerLauncher, saveRouterEnabled } from '../src/main/router';

describe('interrupteur du routeur', () => {
  it('est activé par défaut, puis retient le choix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'router-'));
    expect(loadRouterEnabled(dir)).toBe(true);
    saveRouterEnabled(dir, false);
    expect(loadRouterEnabled(dir)).toBe(false);
    saveRouterEnabled(dir, true);
    expect(loadRouterEnabled(dir)).toBe(true);
  });

  it('reste activé si le fichier est abîmé', () => {
    const dir = mkdtempSync(join(tmpdir(), 'router-'));
    writeFileSync(join(dir, 'router.json'), '{pas du json');
    expect(loadRouterEnabled(dir)).toBe(true);
  });
});

const token = 'jeton-test';
const noSleep = () => Promise.resolve();

function chooser(over: Partial<Parameters<typeof createRouterChooser>[0]> = {}) {
  const startGateway = vi.fn();
  const choose = createRouterChooser({
    enabled: () => true,
    token: () => token,
    isUp: async () => true,
    startGateway,
    sleep: noSleep,
    ...over,
  });
  return { choose, startGateway: (over.startGateway as ReturnType<typeof vi.fn>) ?? startGateway };
}

describe('createRouterChooser', () => {
  it('lance le vrai claude vers la passerelle quand elle répond', async () => {
    const { choose, startGateway } = chooser();
    const launcher = await choose();
    expect(launcher.command).toBe('claude');
    expect(launcher.prefixArgs).toEqual([]);
    expect(launcher.env?.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:3456');
    expect(launcher.env?.ANTHROPIC_AUTH_TOKEN).toBe(token);
    expect(startGateway).not.toHaveBeenCalled();
  });

  it('ne change jamais le dossier de config : sessions et skills restent dans ~/.claude', () => {
    expect(routerLauncher(token).env).not.toHaveProperty('CLAUDE_CONFIG_DIR');
  });

  it('lit le jeton sans les retours à la ligne, null si le fichier manque', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'router-')), 'jeton.txt');
    expect(readRouterToken(path)).toBeNull();
    writeFileSync(path, 'abc\r\n');
    expect(readRouterToken(path)).toBe('abc');
  });

  it('lance claude directement si l\'interrupteur est coupé', async () => {
    const { choose } = chooser({ enabled: () => false });
    expect(await choose()).toBe(DIRECT);
  });

  it('lance claude directement si ccr n\'est pas installé', async () => {
    const { choose } = chooser({ token: () => null });
    expect(await choose()).toBe(DIRECT);
  });

  it('démarre la passerelle si elle dort, puis passe par elle', async () => {
    let up = false;
    const startGateway = vi.fn(() => (up = true));
    const { choose } = chooser({ isUp: async () => up, startGateway });
    expect(await choose()).toEqual(routerLauncher(token));
    expect(startGateway).toHaveBeenCalledOnce();
  });

  it('revient à claude direct si la passerelle ne démarre pas', async () => {
    const startGateway = vi.fn();
    const { choose } = chooser({ isUp: async () => false, startGateway, waitMs: 2000, pollMs: 500 });
    expect(await choose()).toBe(DIRECT);
  });

  it('ne démarre la passerelle qu\'une fois pour deux sessions simultanées', async () => {
    let up = false;
    const startGateway = vi.fn(() => (up = true));
    const { choose } = chooser({ isUp: async () => up, startGateway });
    await Promise.all([choose(), choose()]);
    expect(startGateway).toHaveBeenCalledOnce();
  });
});
