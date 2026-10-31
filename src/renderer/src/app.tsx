import { useEffect, useReducer, useState } from 'react';
import type { ChatItem } from '../../shared/chat-item';
import { buildHandoffPrompt } from '../../shared/handoff';
import type { HistoryProject } from '../../shared/history';
import type { ModelChoice } from '../../shared/model';
import { displayTitle, emptyOrganize, renameSession, toggleFavorite, type OrganizeData } from '../../shared/organize';
import { ChatView } from './components/chat-view';
import { Composer } from './components/composer';
import { HandoffButton } from './components/handoff-button';
import { HandoffDialog } from './components/handoff-dialog';
import { addProject, newProjectId, projectForCwd, removeProject, updateProject } from '../../shared/projects';
import { FavoritesList } from './components/favorites-list';
import { HistoryList } from './components/history-list';
import { HistoryView, TopbarFolder } from './components/history-view';
import { ProjectView, TopbarProject } from './components/project-view';
import { ProjectsList } from './components/projects-list';
import { ModelPicker } from './components/model-picker';
import { ResponderBadge, RouterToggle } from './components/router-toggle';
import { Sidebar } from './components/sidebar';
import { ContextBadge } from './components/usage-gauges';
import { readLastModel, writeLastModel } from './model-choice';
import { Welcome } from './components/welcome';
import { isSidebarToggle, readCollapsed, writeCollapsed } from './ui-format';
import { handoffPhase, type HandoffPhase, type PendingHandoff } from './handoff-flow';
import { initialState, sessionsReducer, type ChatState, type Limits } from './state/sessions';

const COMMANDS_KEY = 'commands';
const LIMITS_KEY = 'limits';

/** Au démarrage : dernières commandes et jauges connues (claude ne les envoie qu'à sa 1re réponse). */
function withSaved(state: ChatState): ChatState {
  try {
    const commands: unknown = JSON.parse(localStorage.getItem(COMMANDS_KEY) ?? '[]');
    const limits: unknown = JSON.parse(localStorage.getItem(LIMITS_KEY) ?? 'null');
    return {
      ...state,
      ...(Array.isArray(commands) && { commands: commands.filter((c) => typeof c === 'string') }),
      ...(isSavedLimits(limits) && { limits }),
    };
  } catch {
    return state;
  }
}

/** Ancienne session affichée en lecture seule (à la place de la session en cours). */
interface Viewing {
  /** `folder/id` */
  key: string;
  title: string;
  path?: string;
  items?: ChatItem[];
  error?: string;
  /** Message trouvé par la recherche dans le contenu. */
  focusIndex?: number;
}

function isSavedLimits(value: unknown): value is Limits {
  return typeof value === 'object' && value !== null && typeof (value as Limits).savedAt === 'number';
}

export function App() {
  const [state, dispatch] = useReducer(sessionsReducer, initialState, withSaved);
  const active = state.sessions.find((s) => s.id === state.activeId) ?? null;
  // `at` : heure de la lecture, sert de « maintenant » pour les dates relatives (pas de Date.now() au rendu).
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [history, setHistory] = useState<{ projects: HistoryProject[]; at: number }>({ projects: [], at: 0 });
  const [organize, setOrganize] = useState<OrganizeData>(emptyOrganize);
  // Tant que organize.json n'est pas lu, un clic enregistrerait un fichier presque vide à la place des vrais favoris.
  const [organizeLoaded, setOrganizeLoaded] = useState(false);
  const [handoff, setHandoff] = useState<PendingHandoff | null>(null);
  const [saving, setSaving] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [lastModel, setLastModel] = useState(() => readLastModel(localStorage));
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  // Fiche de projet affichée (à la place de la session et de la relecture).
  const [projectId, setProjectId] = useState<string | null>(null);
  // Dossiers et fichiers de projets qui n'existent plus.
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const phase: HandoffPhase = active ? handoffPhase(handoff, active) : { phase: 'none' };
  const shownProject = projectId ? organize.projects?.[projectId] : undefined;

  function toggleSidebar() {
    setCollapsed((c) => {
      writeCollapsed(localStorage, !c);
      return !c;
    });
  }

  // Ctrl+B, écouté en phase de capture pour passer avant la zone de saisie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSidebarToggle(e)) return;
      e.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  function refreshHistory() {
    window.claude.listHistory().then(
      (projects) => setHistory({ projects, at: Date.now() }),
      () => setHistory({ projects: [], at: Date.now() }),
    );
  }

  // Favoris et noms : l'état est la référence, le fichier suit sans bloquer l'interface.
  function updateOrganize(next: OrganizeData) {
    if (!organizeLoaded) return;
    setOrganize(next);
    window.claude.setOrganize(next).catch((err) => console.error('organize.json non enregistré', err));
  }

  // Secours Gemini (routeur ccr) : activé par défaut, l'état réel est lu dans main.
  const [router, setRouter] = useState(true);
  function changeRouter(enabled: boolean) {
    setRouter(enabled);
    window.claude.setRouter(enabled).catch((err) => console.error('router.json non enregistré', err));
  }

  useEffect(() => {
    refreshHistory();
    window.claude.getRouter().then(setRouter, (err) => console.error('router.json illisible', err));
    window.claude.getOrganize().then(
      (data) => {
        setOrganize(data);
        setOrganizeLoaded(true);
      },
      (err) => console.error('organize.json illisible', err),
    );
  }, []);

  // Revérifie l'existence des dossiers et fichiers à chaque changement des projets.
  useEffect(() => {
    const paths = Object.values(organize.projects ?? {}).flatMap((p) => [p.folder, ...(p.files ?? [])]);
    if (paths.length === 0) return;
    let stale = false;
    window.claude.pathsExist(paths).then(
      (exists) => {
        if (!stale) setMissing(new Set(paths.filter((_, i) => !exists[i])));
      },
      (err) => console.error('vérification des chemins impossible', err),
    );
    return () => {
      stale = true;
    };
  }, [organize.projects]);

  // Un seul abonnement pour toute l'app : chaque événement de claude devient une action du reducer.
  useEffect(() => window.claude.onEvent(dispatch), []);

  // claude n'envoie la liste des commandes qu'à sa 1re réponse : on garde la dernière pour les sessions neuves.
  useEffect(() => {
    try {
      if (state.commands.length) localStorage.setItem(COMMANDS_KEY, JSON.stringify(state.commands));
    } catch {
      // stockage indisponible : la liste reviendra à la prochaine réponse de claude
    }
  }, [state.commands]);

  // Jauges fraîches (sans savedAt) : on les sauvegarde avec l'heure, pour les montrer grisées au prochain lancement.
  useEffect(() => {
    try {
      if (state.limits && !state.limits.savedAt) {
        localStorage.setItem(LIMITS_KEY, JSON.stringify({ ...state.limits, savedAt: Date.now() }));
      }
    } catch {
      // stockage indisponible : les jauges reviendront à la prochaine réponse
    }
  }, [state.limits]);

  async function newSession() {
    const cwd = await window.claude.pickFolder();
    if (cwd) await startIn(cwd);
  }

  async function newProject() {
    const folder = await window.claude.pickFolder();
    if (!folder || !organizeLoaded) return;
    // Un dossier qui a déjà un projet : on ouvre sa fiche au lieu d'en créer un second.
    const existing = projectForCwd(organize, folder);
    const id = existing?.id ?? newProjectId();
    if (!existing) updateOrganize(addProject(organize, id, folder));
    openProject(id);
  }

  function openProject(id: string) {
    setViewing(null);
    setProjectId(id);
  }

  function deleteProject(id: string) {
    updateOrganize(removeProject(organize, id));
    setProjectId(null);
  }

  async function startIn(cwd: string) {
    const sessionId = await window.claude.startSession(cwd, { model: lastModel });
    setViewing(null);
    setProjectId(null);
    dispatch({ type: 'session-opened', sessionId, cwd, model: lastModel });
  }

  function openHistory(folder: string, id: string, focusIndex?: number) {
    const project = history.projects.find((p) => p.folder === folder);
    const title = project?.sessions.find((s) => s.id === id)?.title ?? id;
    const key = `${folder}/${id}`;
    setProjectId(null);
    setViewing({ key, title, path: project?.path, focusIndex });
    // Si on a cliqué sur une autre session entre-temps, on ignore la réponse arrivée en retard.
    const done = (patch: Pick<Viewing, 'items' | 'error'>) =>
      setViewing((v) => (v?.key === key ? { ...v, ...patch } : v));
    window.claude.readHistory(folder, id).then(
      (items) => done({ items }),
      (err: unknown) => done({ error: `Lecture impossible : ${err instanceof Error ? err.message : String(err)}` }),
    );
  }

  function close(sessionId: string) {
    window.claude.stopSession(sessionId);
    dispatch({ type: 'session-closed', sessionId });
  }

  async function changeModel(model: ModelChoice | undefined) {
    if (!active) return;
    const sessionId = active.id;
    setLastModel(model);
    writeLastModel(localStorage, model);
    try {
      await window.claude.setModel(sessionId, model);
      dispatch({ type: 'model-changed', sessionId, model });
    } catch (err) {
      dispatch({ type: 'error', sessionId, message: `Changement de modèle impossible : ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  function send(text: string) {
    if (!active) return;
    setHandoff(null); // un message normal abandonne la passation en attente
    dispatch({ type: 'user-sent', sessionId: active.id, text });
    window.claude.sendMessage(active.id, text);
  }

  function startHandoff() {
    if (!active) return;
    const fromIndex = active.items.length; // la réponse de claude commencera après la consigne
    send(buildHandoffPrompt());
    setHandoff({ sessionId: active.id, fromIndex });
  }

  async function confirmHandoff(text: string) {
    const from = state.sessions.find((s) => s.id === handoff?.sessionId);
    if (!from) return;
    setSaving({ busy: true });
    try {
      await window.claude.saveHandoff(text, from.id);
      // Session neuve (pas de --resume), avec le même modèle que la session résumée.
      const sessionId = await window.claude.startSession(from.cwd, { model: from.model });
      setHandoff(null);
      setSaving({ busy: false });
      dispatch({ type: 'session-opened', sessionId, cwd: from.cwd, model: from.model });
      dispatch({ type: 'user-sent', sessionId, text });
      window.claude.sendMessage(sessionId, text);
    } catch (err) {
      setSaving({ busy: false, error: `Passation non enregistrée : ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  function cancelHandoff() {
    setHandoff(null);
    setSaving({ busy: false });
  }

  function stop() {
    if (!active) return;
    dispatch({ type: 'user-interrupted', sessionId: active.id });
    window.claude.interrupt(active.id);
  }

  return (
    <div className="app">
      <Sidebar
        sessions={state.sessions}
        activeId={viewing || shownProject ? null : state.activeId}
        limits={state.limits}
        footer={<RouterToggle enabled={router} onChange={changeRouter} />}
        onNew={newSession}
        onSelect={(sessionId) => {
          setViewing(null);
          setProjectId(null);
          dispatch({ type: 'select', sessionId });
        }}
        onClose={close}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      >
        <ProjectsList
          history={history.projects}
          organize={organize}
          openKey={viewing?.key}
          openProjectId={shownProject ? projectId ?? undefined : undefined}
          missing={missing}
          onOpen={openHistory}
          onOpenProject={openProject}
          onToggleFavorite={(key) => updateOrganize(toggleFavorite(organize, key))}
          onNewProject={() => void newProject()}
          onNewSession={(folder) => void startIn(folder)}
        />
        <FavoritesList
          projects={history.projects}
          organize={organize}
          openKey={viewing?.key}
          onOpen={openHistory}
          onToggleFavorite={(key) => updateOrganize(toggleFavorite(organize, key))}
        />
        <HistoryList
          projects={history.projects}
          now={history.at}
          openKey={viewing?.key}
          onOpen={openHistory}
          onRefresh={refreshHistory}
          organize={organize}
          onToggleFavorite={(key) => updateOrganize(toggleFavorite(organize, key))}
          onRename={(key, title) => updateOrganize(renameSession(organize, key, title))}
        />
      </Sidebar>
      {shownProject && projectId ? (
        <ProjectView
          key={projectId}
          project={shownProject}
          missing={missing}
          onChange={(patch) => updateOrganize(updateProject(organize, projectId, patch))}
          onPickFiles={() => window.claude.pickFiles()}
          onNewSession={() => void startIn(shownProject.folder)}
          onDelete={() => deleteProject(projectId)}
        />
      ) : viewing ? (
        <HistoryView
          title={displayTitle(viewing, organize.sessions[viewing.key])}
          path={viewing.path}
          items={viewing.items}
          error={viewing.error}
          focusIndex={viewing.focusIndex}
          favorite={!!organize.sessions[viewing.key]?.favorite}
          onToggleFavorite={() => updateOrganize(toggleFavorite(organize, viewing.key))}
          onRename={(title) => updateOrganize(renameSession(organize, viewing.key, title))}
        />
      ) : active ? (
        <main className="session">
          <header className="topbar">
            <span className="topbar-title">
              {active.title}
              <TopbarFolder title={active.title} path={active.cwd} />
            </span>
            <TopbarProject organize={organize} cwd={active.cwd} />
            <ResponderBadge responder={active.responder} />
            {active.context && (
              <span className="topbar-ctx">
                Contexte : <ContextBadge context={active.context} />
              </span>
            )}
            <HandoffButton session={active} phase={phase.phase} onClick={startHandoff} />
          </header>
          <ChatView items={active.items} running={active.status === 'running'} />
          <Composer running={active.status === 'running'} onSend={send} onStop={stop} onPickFiles={() => window.claude.pickFiles()} pathForFile={(f) => window.claude.pathForFile(f)}
            onSavePasted={(bytes, ext) => window.claude.savePastedImage(bytes, ext)} commands={state.commands} suggestion={active.suggestion}
            tools={
              <ModelPicker
                value={active.model}
                activeModel={active.activeModel}
                disabled={active.status === 'running'}
                onChange={(model) => void changeModel(model)}
              />
            } />
          {phase.phase === 'review' && (
            <HandoffDialog
              initialText={phase.text}
              busy={saving.busy}
              error={saving.error}
              onCancel={cancelHandoff}
              onConfirm={(text) => void confirmHandoff(text)}
            />
          )}
        </main>
      ) : (
        <Welcome onNew={newSession} />
      )}
    </div>
  );
}
