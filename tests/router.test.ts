import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createRouterChooser, DIRECT, loadRouterEnabled, routerLauncher, saveRouterEnabled } from '../src/main/router';

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

const cli = 'C:/fake/cli.js';
const noSleep = () => Promise.resolve();

function chooser(over: Partial<Parameters<typeof createRouterChooser>[0]> = {}) {
  const startGateway = vi.fn();
  const choose = createRouterChooser({
    enabled: () => true,
    cli,
    exists: () => true,
    isUp: async () => true,
    startGateway,
    sleep: noSleep,
    ...over,
  });
  return { choose, startGateway: (over.startGateway as ReturnType<typeof vi.fn>) ?? startGateway };
}

describe('createRouterChooser', () => {
  it('passe par ccr mix quand la passerelle répond', async () => {
    const { choose, startGateway } = chooser();
    expect(await choose()).toEqual({ command: 'node', prefixArgs: [cli, 'mix', 'cli', '--'] });
    expect(startGateway).not.toHaveBeenCalled();
  });

  it('lance claude directement si l\'interrupteur est coupé', async () => {
    const { choose } = chooser({ enabled: () => false });
    expect(await choose()).toBe(DIRECT);
  });

  it('lance claude directement si ccr n\'est pas installé', async () => {
    const { choose } = chooser({ exists: () => false });
    expect(await choose()).toBe(DIRECT);
  });

  it('démarre la passerelle si elle dort, puis passe par elle', async () => {
    let up = false;
    const startGateway = vi.fn(() => (up = true));
    const { choose } = chooser({ isUp: async () => up, startGateway });
    expect(await choose()).toEqual(routerLauncher(cli));
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
