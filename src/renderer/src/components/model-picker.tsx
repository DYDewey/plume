import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ModelSetting, Route } from '../../../shared/auto-route';
import { MODEL_CHOICES, type ModelChoice } from '../../../shared/model';

/** « Auto », « Par défaut » (undefined) puis les modèles, dans l'ordre du menu. */
export const MODEL_OPTIONS: { value: ModelSetting | undefined; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: undefined, label: 'Par défaut' },
  ...MODEL_CHOICES,
];

const LABEL: Record<ModelChoice, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

/** Texte du bouton : en Auto, on montre aussi le modèle choisi pour le dernier message. */
export function pickerLabel(value: ModelSetting | undefined, model?: ModelChoice): string {
  const option = MODEL_OPTIONS.find((o) => o.value === value) ?? MODEL_OPTIONS[1];
  return value === 'auto' && model ? `Auto · ${LABEL[model]}` : option.label;
}

export function routeText(route: Route): string {
  return `${LABEL[route.model]} : ${route.reason} (${route.source})`;
}

interface MenuState {
  open: boolean;
  index: number;
}

/** Effet d'une touche sur le menu ; `choose` = valider l'option `index` ; null = touche laissée au navigateur. */
export function menuKey(state: MenuState, key: string, count: number): (MenuState & { choose?: true }) | null {
  if (key === 'ArrowDown') return { open: true, index: state.open ? (state.index + 1) % count : state.index };
  if (key === 'ArrowUp') return { open: true, index: state.open ? (state.index - 1 + count) % count : state.index };
  if (key === 'Enter' && state.open) return { open: false, index: state.index, choose: true };
  if (key === 'Escape' && state.open) return { open: false, index: state.index };
  return null;
}

export function ModelPicker({
  value,
  autoModel,
  route,
  activeModel,
  disabled,
  onChange,
  initialOpen = false,
}: {
  value?: ModelSetting;
  /** En Auto : modèle actuellement lancé. */
  autoModel?: ModelChoice;
  /** En Auto : dernier choix et sa raison. */
  route?: Route;
  /** Modèle réellement utilisé, lu dans le flux (inconnu avant la 1re réponse). */
  activeModel?: string;
  disabled: boolean;
  onChange: (model: ModelSetting | undefined) => void;
  /** Pour les tests : rendu avec le menu déjà ouvert. */
  initialOpen?: boolean;
}) {
  const found = MODEL_OPTIONS.findIndex((o) => o.value === value);
  const current = found < 0 ? 1 : found; // valeur inconnue : « Par défaut »
  const [menu, setMenu] = useState<MenuState>({ open: initialOpen, index: current });
  const root = useRef<HTMLSpanElement>(null);

  // Un clic en dehors du menu le ferme.
  useEffect(() => {
    if (!menu.open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu((m) => ({ ...m, open: false }));
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu.open]);

  function choose(index: number) {
    setMenu({ open: false, index });
    if (index !== current) onChange(MODEL_OPTIONS[index].value);
  }

  function onKeyDown(e: KeyboardEvent) {
    const next = menuKey(menu.open ? menu : { open: false, index: current }, e.key, MODEL_OPTIONS.length);
    if (!next) return;
    e.preventDefault();
    if (next.choose) choose(next.index);
    else setMenu({ open: next.open, index: next.index });
  }

  return (
    <span className="model-picker" ref={root}>
      <button
        type="button"
        className="btn-secondary model-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={menu.open}
        onClick={() => setMenu({ open: !menu.open, index: current })}
        onKeyDown={onKeyDown}
        title={
          value === 'auto'
            ? `Auto : le modèle est choisi avant chaque message${route ? `\nDernier choix : ${routeText(route)}` : ''}`
            : 'Modèle de la session : le changer relance claude, la conversation continue'
        }
      >
        {pickerLabel(value, autoModel)}
        <ChevronDown size={14} aria-hidden />
      </button>
      {menu.open && (
        <ul className="model-menu" role="listbox" aria-label="Modèle">
          {MODEL_OPTIONS.map((o, i) => (
            <li
              key={o.label}
              role="option"
              aria-selected={i === current}
              className={i === menu.index ? 'selected' : undefined}
              onMouseDown={(e) => e.preventDefault()} // garde le focus sur le bouton
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {i === current && <Check size={14} aria-hidden />}
            </li>
          ))}
          {value === 'auto' && route && <li className="model-active muted">Dernier choix : {routeText(route)}</li>}
          {activeModel && <li className="model-active muted">Utilisé : {activeModel}</li>}
        </ul>
      )}
    </span>
  );
}
