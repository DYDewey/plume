// Faux CLI claude pour les tests : à chaque message reçu sur stdin, rejoue le flux capturé.
// Le message « args? » renvoie les arguments reçus (pour vérifier --model / --resume) ; « args-json? » les renvoie en JSON, intacts.
// Une requête de contrôle `interrupt` reçoit la même réponse que le vrai CLI (vérifiée le 24/10/2026).
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const readline = require('node:readline');

const stream = readFileSync(join(__dirname, 'stream-bonjour.jsonl'), 'utf8');
const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (msg.type === 'control_request' && msg.request?.subtype === 'interrupt') {
    out({ type: 'control_response', response: { subtype: 'success', request_id: msg.request_id, response: { still_queued: [] } } });
    out({ type: 'result', subtype: 'error_during_execution', is_error: true, total_cost_usd: 0 });
    return;
  }
  // Réponse à une demande de permission : renvoyée telle quelle en texte, pour que le test la lise.
  if (msg.type === 'control_response') {
    const text = 'réponse:' + JSON.stringify(msg.response);
    out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
    out({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: 0 });
    return;
  }
  if (msg.message?.content === 'permission?' || msg.message?.content === 'question?') {
    const question = msg.message.content === 'question?';
    out({
      type: 'control_request',
      request_id: 'req-1',
      request: {
        subtype: 'can_use_tool',
        tool_name: question ? 'AskUserQuestion' : 'Bash',
        input: { command: 'curl example.com' },
        description: 'Télécharger',
        permission_suggestions: [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'curl example.com' }], behavior: 'allow', destination: 'userSettings' }],
        ...(question && { requires_user_interaction: true }),
      },
    });
    return;
  }
  if (msg.message?.content === 'annule?') {
    out({ type: 'control_cancel_request', request_id: 'req-1' });
    out({ type: 'result', subtype: 'success', is_error: false, result: 'fin', total_cost_usd: 0 });
    return;
  }
  if (msg.message?.content === 'args?' || msg.message?.content === 'args-json?') {
    const args = process.argv.slice(2);
    const text = msg.message.content === 'args?' ? args.join(' ') : JSON.stringify(args);
    out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
    out({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: 0 });
    return;
  }
  process.stdout.write(stream);
});
