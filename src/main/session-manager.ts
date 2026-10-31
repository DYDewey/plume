import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BridgeEvent } from '../shared/events';
import type { ModelChoice } from '../shared/model';
import { buildClaudeArgs } from './claude-args';
import type { Launcher } from './router';
import { createStreamParser } from './stream-parser';

export interface SessionManagerOptions {
  /** Exécutable à lancer (par défaut `claude`, trouvé via le PATH). */
  command?: string;
  /** Arguments placés avant ceux de claude (sert aux tests avec un faux claude). */
  prefixArgs?: string[];
  /** Choisi à chaque lancement, prioritaire sur command/prefixArgs (claude direct ou via le routeur ccr). */
  launcher?: () => Launcher;
  /** Texte à ajouter au prompt système pour une session lancée dans `cwd` (instructions du projet), relu à chaque lancement. */
  promptFor?: (cwd: string) => string | null;
}

export class SessionManager {
  private sessions = new Map<string, ChildProcessWithoutNullStreams>();
  /** Dossier de travail de chaque session, pour pouvoir la relancer (changement de modèle). */
  private cwds = new Map<string, string>();
  /** Sessions qui ont une conversation sur disque (reprise, ou au moins un message envoyé) : restart peut utiliser --resume. */
  private withConversation = new Set<string>();
  /** Sessions dont on a demandé l'interruption : leur prochain `result` est en erreur, c'est normal. */
  private interrupting = new Set<string>();

  constructor(
    private emit: (event: BridgeEvent) => void,
    private options: SessionManagerOptions = {},
  ) {}

  /** Lance une session dans `cwd` et renvoie son identifiant. */
  start(cwd: string, resumeId?: string, model?: ModelChoice): string {
    const sessionId = resumeId ?? randomUUID();
    if (resumeId) this.withConversation.add(sessionId);
    this.launch(cwd, sessionId, model);
    return sessionId;
  }

  private launch(cwd: string, sessionId: string, model: ModelChoice | undefined): void {
    const { command, prefixArgs } = this.options.launcher?.() ?? {
      command: this.options.command ?? 'claude',
      prefixArgs: this.options.prefixArgs ?? [],
    };
    const resume = this.withConversation.has(sessionId);
    const appendSystemPrompt = this.options.promptFor?.(cwd) ?? undefined;
    const args = [
      ...prefixArgs,
      ...buildClaudeArgs({ sessionId, resume, model, appendSystemPrompt }),
    ];

    // Sans cette variable, claude -p ignore --prompt-suggestions (vérifié avec la v2.1.310).
    const env = { ...process.env, CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: '1' };
    const child = spawn(command, args, { cwd, env, windowsHide: true });
    this.sessions.set(sessionId, child);
    this.cwds.set(sessionId, cwd);
    // Après un restart, l'ancien processus porte le même id : ses événements tardifs sont ignorés.
    const isCurrent = () => this.sessions.get(sessionId) === child;

    const parser = createStreamParser(sessionId);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!isCurrent()) return;
      for (const event of parser.push(chunk)) {
        if (this.interrupting.has(sessionId)) {
          if (event.type === 'error') continue;
          if (event.type === 'turn-end') this.interrupting.delete(sessionId);
        }
        this.emit(event);
      }
    });

    // On garde la fin de stderr pour expliquer un éventuel plantage.
    let stderrTail = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderrTail = (stderrTail + chunk).slice(-2000);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (!isCurrent()) return;
      this.sessions.delete(sessionId);
      const message =
        err.code === 'ENOENT'
          ? `Commande « ${command} » introuvable. Claude Code est-il installé et dans le PATH ?`
          : `Impossible de lancer claude : ${err.message}`;
      this.emit({ type: 'error', sessionId, message });
    });

    child.on('exit', (code) => {
      // Une session arrêtée volontairement (ou relancée) n'est plus associée à ce processus.
      if (!isCurrent()) return;
      this.sessions.delete(sessionId);
      if (code !== 0) {
        this.emit({ type: 'error', sessionId, message: `claude s'est arrêté (code ${code}). ${stderrTail.trim()}` });
      }
    });
  }

  send(sessionId: string, text: string): void {
    const child = this.sessions.get(sessionId);
    if (!child) {
      this.emit({ type: 'error', sessionId, message: 'Session inconnue ou arrêtée.' });
      return;
    }
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
    child.stdin.write(line + '\n');
    this.withConversation.add(sessionId);
  }

  /** Arrête la réponse en cours ; la session reste ouverte et se souvient du début. */
  interrupt(sessionId: string): void {
    const child = this.sessions.get(sessionId);
    if (!child) return;
    this.interrupting.add(sessionId);
    const line = JSON.stringify({ type: 'control_request', request_id: randomUUID(), request: { subtype: 'interrupt' } });
    child.stdin.write(line + '\n');
  }

  stop(sessionId: string): void {
    const child = this.sessions.get(sessionId);
    if (!child) return;
    this.sessions.delete(sessionId);
    this.cwds.delete(sessionId);
    this.interrupting.delete(sessionId);
    killTree(child);
  }

  /**
   * Relance la session avec un autre modèle. Avec une conversation sur disque, --resume la reprend ;
   * sinon (aucun message encore), on garde le même id avec --session-id : --resume échouerait.
   */
  restart(sessionId: string, model: ModelChoice | undefined): void {
    const cwd = this.cwds.get(sessionId);
    if (cwd === undefined) {
      this.emit({ type: 'error', sessionId, message: 'Session inconnue ou arrêtée.' });
      return;
    }
    this.stop(sessionId);
    this.launch(cwd, sessionId, model);
  }

  stopAll(): void {
    for (const id of [...this.sessions.keys()]) this.stop(id);
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

function killTree(child: ChildProcessWithoutNullStreams): void {
  // Sous Windows, kill() ne tue pas les sous-processus (hooks, serveurs MCP) : taskkill /T le fait.
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    child.kill();
  }
}
