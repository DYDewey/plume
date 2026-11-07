import { describe, expect, it } from 'vitest';
import { buildClaudeArgs, isSessionId } from '../src/main/claude-args';

const base = [
  '-p',
  '--input-format', 'stream-json',
  '--output-format', 'stream-json',
  '--verbose',
  '--include-partial-messages',
  '--permission-mode', 'acceptEdits',
  '--permission-prompt-tool', 'stdio',
  '--prompt-suggestions', 'true',
];

describe('buildClaudeArgs', () => {
  it('continue dans une copie : --fork-session, l\'original reste intact', () => {
    expect(buildClaudeArgs({ sessionId: 'neuf', forkFrom: 'ancien' })).toEqual([...base, '--resume', 'ancien', '--fork-session', '--session-id', 'neuf']);
  });

  it('une copie déjà commencée reprend son propre fichier', () => {
    expect(buildClaudeArgs({ sessionId: 'neuf', forkFrom: 'ancien', resume: true })).toEqual([...base, '--resume', 'neuf']);
  });

  it('n\'accepte comme session à continuer qu\'un vrai identifiant', () => {
    expect(isSessionId('7510a2a2-decb-4c1b-b437-d5cdc2892484')).toBe(true);
    expect(isSessionId('--dangerously-skip-permissions')).toBe(false);
    expect(isSessionId(42)).toBe(false);
  });

  it('nouvelle session : impose notre identifiant', () => {
    expect(buildClaudeArgs({ sessionId: 'abc' })).toEqual([...base, '--session-id', 'abc']);
  });

  it('reprise : utilise --resume', () => {
    expect(buildClaudeArgs({ sessionId: 'abc', resume: true })).toEqual([...base, '--resume', 'abc']);
  });

  it('ajoute --model quand un modèle est choisi', () => {
    expect(buildClaudeArgs({ sessionId: 'abc', model: 'sonnet' })).toEqual([...base, '--model', 'sonnet', '--session-id', 'abc']);
    expect(buildClaudeArgs({ sessionId: 'abc', resume: true, model: 'haiku' })).toEqual([...base, '--model', 'haiku', '--resume', 'abc']);
  });

  it("« Par défaut » : pas d'option --model", () => {
    expect(buildClaudeArgs({ sessionId: 'abc' })).not.toContain('--model');
  });

  it("n'utilise jamais --bare (les skills perso doivent se charger)", () => {
    expect(buildClaudeArgs({ sessionId: 'abc' })).not.toContain('--bare');
  });

  it('ajoute les instructions du projet au prompt système', () => {
    expect(buildClaudeArgs({ sessionId: 'abc', appendSystemPrompt: 'Sois bref' })).toEqual([
      ...base, '--append-system-prompt', 'Sois bref', '--session-id', 'abc',
    ]);
    expect(buildClaudeArgs({ sessionId: 'abc' })).not.toContain('--append-system-prompt');
  });
});
