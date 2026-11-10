import { Keyboard, MessageSquare, Palette, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { HANDOFF_THRESHOLD, type PermissionMode, type Settings } from '../../../shared/settings';

type Tab = 'general' | 'appearance' | 'claude' | 'shortcuts';

interface Props {
  settings: Settings;
  /** Secours Gemini (routeur ccr), enregistré à part dans router.json. */
  router: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onRouterChange: (enabled: boolean) => void;
  onClose: () => void;
}

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'general', label: 'Général', icon: <MessageSquare size={16} aria-hidden /> },
  { id: 'appearance', label: 'Apparence', icon: <Palette size={16} aria-hidden /> },
  { id: 'claude', label: 'Claude', icon: <ShieldCheck size={16} aria-hidden /> },
  { id: 'shortcuts', label: 'Raccourcis', icon: <Keyboard size={16} aria-hidden /> },
];

const PERMISSIONS: { value: PermissionMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Automatique', hint: 'Les actions sûres passent toutes seules, seules les risquées te sont demandées. Recommandé.' },
  { value: 'acceptEdits', label: 'Modifications seulement', hint: 'Les modifications de fichiers passent, tout le reste t’est demandé.' },
  { value: 'manual', label: 'Toujours demander', hint: 'Chaque action de Claude attend ton accord.' },
];

const SHORTCUTS: [string, string][] = [
  ['Entrée', 'Envoyer le message (ou Ctrl+Entrée, selon le réglage)'],
  ['Maj+Entrée', 'Aller à la ligne'],
  ['Tab', 'Reprendre le message proposé'],
  ['/', 'Commandes et skills'],
  ['Ctrl+N', 'Nouvelle conversation'],
  ['Ctrl+K', 'Rechercher dans l’historique'],
  ['Ctrl+Tab', 'Conversation ouverte suivante'],
  ['Ctrl+Maj+Tab', 'Conversation ouverte précédente'],
  ['Ctrl+F', 'Rechercher dans la conversation'],
  ['Ctrl+B', 'Replier ou déplier la barre latérale'],
  ['Ctrl+,', 'Ouvrir les paramètres'],
  ['Échap', 'Fermer un menu ou les paramètres'],
];

/** Choix parmi quelques options, comme des boutons radio (flèches gauche/droite au clavier). */
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const move = (step: number) => {
    const i = options.findIndex((o) => o.value === value);
    onChange(options[(i + step + options.length) % options.length].value);
  };
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) {
          e.preventDefault();
          move(step);
        }
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className={o.value === value ? 'on' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Interrupteur marche / arrêt. */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? 'switch on' : 'switch'} onClick={() => onChange(!checked)}>
      <span className="switch-thumb" />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <div className="settings-row-title">{title}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export function SettingsView({ settings, router, onChange, onRouterChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('general');

  // Échap ferme, sauf si un menu ouvert l'a déjà utilisé.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <main className="settings" aria-label="Paramètres">
      <nav className="settings-nav" aria-label="Sections des paramètres">
        <h1>Paramètres</h1>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'settings-tab on' : 'settings-tab'} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>
      <section className="settings-body">
        <button type="button" className="btn-icon settings-close" onClick={onClose} aria-label="Fermer les paramètres" title="Fermer (Échap)">
          <X size={18} aria-hidden />
        </button>

        {tab === 'general' && (
          <>
            <h2>Général</h2>
            <Row title="Envoyer le message" hint="L'autre combinaison fait un saut de ligne.">
              <Segmented label="Touche d'envoi" value={settings.sendKey} onChange={(sendKey) => onChange({ sendKey })}
                options={[{ value: 'enter', label: 'Entrée' }, { value: 'ctrl-enter', label: 'Ctrl+Entrée' }]} />
            </Row>
            <Row title="Sessions techniques dans l'historique" hint="Conversations lancées en arrière-plan par des outils (claude-mem…). Masquées par défaut.">
              <Switch label="Afficher les sessions techniques" checked={settings.showTechnical} onChange={(showTechnical) => onChange({ showTechnical })} />
            </Row>
            <Row title="Notification de fin de réponse" hint="Une notification Windows quand Claude a fini et que tu es dans une autre fenêtre.">
              <Switch label="Notification de fin de réponse" checked={settings.notify} onChange={(notify) => onChange({ notify })} />
            </Row>
          </>
        )}

        {tab === 'appearance' && (
          <>
            <h2>Apparence</h2>
            <Row title="Thème" hint="« Système » suit le réglage clair / sombre de Windows.">
              <Segmented label="Thème" value={settings.theme} onChange={(theme) => onChange({ theme })}
                options={[{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} />
            </Row>
            <Row title="Taille du texte">
              <Segmented label="Taille du texte" value={settings.textSize} onChange={(textSize) => onChange({ textSize })}
                options={[{ value: 'small', label: 'Petite' }, { value: 'normal', label: 'Normale' }, { value: 'large', label: 'Grande' }]} />
            </Row>
          </>
        )}

        {tab === 'claude' && (
          <>
            <h2>Claude</h2>
            <div className="settings-group-title">Autorisations</div>
            <p className="settings-note">S'applique aux nouvelles conversations.</p>
            <div className="choice-list" role="radiogroup" aria-label="Autorisations">
              {PERMISSIONS.map((p) => (
                <button key={p.value} type="button" role="radio" aria-checked={settings.permissionMode === p.value}
                  className={settings.permissionMode === p.value ? 'choice on' : 'choice'} onClick={() => onChange({ permissionMode: p.value })}>
                  <span className="choice-dot" aria-hidden />
                  <span>
                    <span className="choice-label">{p.label}</span>
                    <span className="choice-hint">{p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <Row title="Secours Gemini" hint="Quand le quota Claude est épuisé, les réponses passent par Gemini (gratuit). S'applique aux nouvelles conversations.">
              <Switch label="Secours Gemini" checked={router} onChange={onRouterChange} />
            </Row>
            <Row title="Proposer une passation" hint={`Quand le contexte dépasse ${Math.round(HANDOFF_THRESHOLD * 100)} %, un bandeau propose de repartir d'un résumé : Claude reste précis et le quota dure plus longtemps.`}>
              <Switch label="Proposer une passation" checked={settings.autoHandoff} onChange={(autoHandoff) => onChange({ autoHandoff })} />
            </Row>
            <Row title="Artefacts automatiques" hint="Claude fait de lui-même un schéma, un diagramme ou une petite page quand ça aide, et l'aperçu s'ouvre à la fin de la réponse. S'applique aux nouvelles conversations.">
              <Switch label="Artefacts automatiques" checked={settings.autoArtifacts} onChange={(autoArtifacts) => onChange({ autoArtifacts })} />
            </Row>
          </>
        )}

        {tab === 'shortcuts' && (
          <>
            <h2>Raccourcis clavier</h2>
            <dl className="shortcuts">
              {SHORTCUTS.map(([keys, what]) => (
                <div key={keys} className="shortcut">
                  <dt>{keys.split('+').map((k, i) => <kbd key={i}>{k}</kbd>)}</dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>
    </main>
  );
}
