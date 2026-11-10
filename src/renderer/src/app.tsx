import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { claudeFolder } from '../../shared/auto-title';
import { initialTrack, titleRequest, type TitleTrack } from './auto-title-flow';
import type { ChatItem } from '../../shared/chat-item';
import { buildHandoffPrompt } from '../../shared/handoff';
import type { HistoryProject } from '../../shared/history';
import { displayTitle, emptyOrganize, renameSession, sessionKey, toggleFavorite, type OrganizeData } from '../../shared/organize';
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
import { ResponderBadge } from './components/router-toggle';
import { SettingsView } from './components/settings-view';
import { DEFAULT_SETTINGS, HANDOFF_THRESHOLD, type Settings } from '../../shared/settings';
import { Sidebar } from './components/sidebar';
import { ContextBadge } from './components/usage-gauges';
import { launchModel, readLastModel, writeLastModel } from './model-choice';
import type { ModelSetting } from '../../shared/auto-route';
import { Welcome } from './components/welcome';
import { ArtifactPanel } from './components/artifact-panel';
import { ExportMenu } from './components/export-menu';
import { ArtifactContext } from './artifact-context';
import type { Artifact } from '../../shared/artifacts';
import { exportFileName, toMarkdown } from '../../shared/export';
import { lastArtifact } from '../../shared/auto-artifact';
import { addPrompt, parsePrompts, removePrompt, type SavedPrompt } from '../../shared/prompts';
import { TitleBar } from './components/title-bar';
import { readArtifactWidth, writeArtifactWidth, HISTORY_SEARCH_ID, isCtrlLetter, isSettingsShortcut, isSidebarToggle, neighborSession, readCollapsed, tabDirection, writeCollapsed } from './ui-format';
import { handoffPhase, shouldSuggestHandoff, type HandoffPhase, type PendingHandoff } from './handoff-flow';
import { HandoffBanner } from './components/handoff-banner';
import { initialState, lastUserText, sessionsReducer, type ChatState, type Limits, type SessionState } from './state/sessions';

const COMMANDS_KEY = 'commands';
const LIMITS_KEY = 'limits';
const PROMPTS_KEY = 'mon-claude:prompts';

function readPrompts(): SavedPrompt[] {
  try {
    return parsePrompts(localStorage.getItem(PROMPTS_KEY));
  } catch {
    return [];
  }
}

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
  id: string;
  /** Le dossier de la session n'existe plus (vérifié à l'ouverture). */
  folderMissing?: boolean;
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
  const [collapsed, setCollapsed] = useState(() => readCollapsed(localStorage));
  // Modèles de messages (panneau des prompts), gardés dans le stockage local de l'app.
  const [prompts, setPrompts] = useState<SavedPrompt[]>(readPrompts);
  function changePrompts(next: SavedPrompt[]) {
    setPrompts(next);
    try {
      localStorage.setItem(PROMPTS_KEY, JSON.stringify(next));
    } catch {
      setNotice('Modèles non enregistrés : stockage indisponible');
    }
  }
  const promptProps = {
    prompts,
    onSavePrompt: (text: string) => {
      changePrompts(addPrompt(prompts, text, crypto.randomUUID()));
      setNotice('Modèle enregistré');
    },
    onDeletePrompt: (id: string) => changePrompts(removePrompt(prompts, id)),
  };
  // Artefact ouvert dans le panneau de droite.
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const loadArtifact = useCallback((html: string) => window.claude.showArtifact(html), []);
  // À l'ouverture, la barre latérale se replie pour laisser de la place ; elle revient à la fermeture
  // seulement si c'est le panneau qui l'avait repliée (pas enregistré : ce n'est pas un choix de l'utilisateur).
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const autoCollapsed = useRef(false);
  const openArtifact = useCallback((a: Artifact) => {
    setArtifact(a);
    if (!collapsedRef.current) {
      autoCollapsed.current = true;
      setCollapsed(true);
    }
  }, []);
  const closeArtifact = useCallback(() => {
    setArtifact(null);
    if (autoCollapsed.current) {
      autoCollapsed.current = false;
      setCollapsed(false);
    }
  }, []);
  // Largeur du panneau, réglée à la souris et retenue entre deux lancements.
  const [artifactWidth, setArtifactWidth] = useState(() => readArtifactWidth(localStorage));
  // Petit message en bas (export réussi ou raté), effacé après quelques secondes.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  // Sessions où l'on a répondu « Plus tard » au bandeau de passation.
  const [handoffDismissed, setHandoffDismissed] = useState<ReadonlySet<string>>(new Set());
  const [lastModel, setLastModel] = useState(() => readLastModel(localStorage));
  // Fiche de projet affichée (à la place de la session et de la relecture).
  const [projectId, setProjectId] = useState<string | null>(null);
  // Dossiers et fichiers de projets qui n'existent plus.
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const phase: HandoffPhase = active ? handoffPhase(handoff, active) : { phase: 'none' };
  const shownProject = projectId ? organize.projects?.[projectId] : undefined;

  function toggleSidebar() {
    autoCollapsed.current = false; // choix de l'utilisateur : le panneau ne la rouvrira pas
    setCollapsed((c) => {
      writeCollapsed(localStorage, !c);
      return !c;
    });
  }

  // Raccourcis globaux, écoutés en phase de capture pour passer avant la zone de saisie.
  // Une ref garde les fonctions à jour sans réabonner l'écouteur à chaque rendu.
  const noop = () => {};
  const shortcuts = useRef<{ newSession: () => void; search: () => void; cycle: (step: -1 | 1) => void }>({ newSession: noop, search: noop, cycle: noop });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = tabDirection(e);
      const action = isSidebarToggle(e)
        ? toggleSidebar
        : isCtrlLetter(e, 'n')
          ? shortcuts.current.newSession
          : isCtrlLetter(e, 'k')
            ? shortcuts.current.search
            : step
              ? () => shortcuts.current.cycle(step)
              : null;
      if (!action) return;
      e.preventDefault();
      action();
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

  // Réglages : affichés tout de suite, puis remplacés par ce que main a vraiment enregistré.
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  function changeSettings(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }));
    window.claude.setSettings(patch).then(setSettings, (err) => console.error('settings.json non enregistré', err));
  }
  useEffect(() => {
    document.documentElement.dataset.textSize = settings.textSize;
  }, [settings.textSize]);

  // Ctrl+, ouvre ou ferme les paramètres.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSettingsShortcut(e)) return;
      e.preventDefault();
      setSettingsOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    refreshHistory();
    window.claude.getRouter().then(setRouter, (err) => console.error('router.json illisible', err));
    window.claude.getSettings().then(setSettings, (err) => console.error('settings.json illisible', err));
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

  // Titre automatique : après chaque réponse, tant que le but n'est pas clair, on demande au juge Gemini gratuit.
  // Le titre est enregistré comme un renommage (organize.json) : les fichiers de Claude Code ne sont jamais touchés.
  const titles = useRef(new Map<string, TitleTrack>());
  const organizeRef = useRef(organize);
  organizeRef.current = organize;
  useEffect(() => {
    if (!organizeLoaded) return;
    for (const s of state.sessions) {
      const key = sessionKey(claudeFolder(s.cwd), s.id);
      if (!titles.current.has(s.id)) titles.current.set(s.id, initialTrack(s.items));
      const track = titles.current.get(s.id);
      const req = titleRequest(s, track, !!organize.sessions[key]?.title);
      if (!req) continue;
      titles.current.set(s.id, { tries: (track?.tries ?? 0) + 1, userCount: req.userCount, done: false });
      window.claude.titleSession(req.userTexts, req.lastReply).then(
        (title) => {
          if (!title || organizeRef.current.sessions[key]?.title) return;
          titles.current.set(s.id, { tries: (track?.tries ?? 0) + 1, userCount: req.userCount, done: true });
          dispatch({ type: 'titled', sessionId: s.id, title });
          updateOrganize(renameSession(organizeRef.current, key, title));
          refreshHistory();
        },
        () => {}, // pas de titre : on réessaiera au prochain message
      );
    }
    // updateOrganize et refreshHistory changent à chaque rendu mais ne lisent que des refs et des setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions, organize, organizeLoaded]);

  // Artefacts automatiques : à la fin d'une réponse de la session affichée, son dernier artefact s'ouvre.
  // Pas pendant le flux : le code serait incomplet.
  const lastStatus = useRef(new Map<string, SessionState['status']>());
  useEffect(() => {
    for (const s of state.sessions) {
      const before = lastStatus.current.get(s.id);
      lastStatus.current.set(s.id, s.status);
      if (before !== 'running' || s.status !== 'idle') continue;
      if (!settings.autoArtifacts || s.id !== state.activeId || viewing || settingsOpen || projectId) continue;
      const found = lastArtifact(s.items);
      if (found) openArtifact(found);
    }
  }, [state.sessions, state.activeId, settings.autoArtifacts, viewing, settingsOpen, projectId, openArtifact]);

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
    setSettingsOpen(false);
    setViewing(null);
    setProjectId(id);
  }

  function deleteProject(id: string) {
    updateOrganize(removeProject(organize, id));
    setProjectId(null);
  }

  async function startIn(cwd: string) {
    const sessionId = await window.claude.startSession(cwd, { model: launchModel(lastModel) });
    setSettingsOpen(false);
    setViewing(null);
    setProjectId(null);
    closeArtifact();
    dispatch({ type: 'session-opened', sessionId, cwd, model: lastModel });
  }

  function openHistory(folder: string, id: string, focusIndex?: number) {
    closeArtifact();
    setSettingsOpen(false);
    const project = history.projects.find((p) => p.folder === folder);
    const title = project?.sessions.find((s) => s.id === id)?.title ?? id;
    const key = `${folder}/${id}`;
    setProjectId(null);
    setViewing({ key, id, title, path: project?.path, focusIndex, folderMissing: !project?.path });
    // Si on a cliqué sur une autre session entre-temps, on ignore la réponse arrivée en retard.
    const done = (patch: Partial<Pick<Viewing, 'items' | 'error' | 'folderMissing'>>) =>
      setViewing((v) => (v?.key === key ? { ...v, ...patch } : v));
    window.claude.readHistory(folder, id).then(
      (items) => done({ items }),
      (err: unknown) => done({ error: `Lecture impossible : ${err instanceof Error ? err.message : String(err)}` }),
    );
    if (project?.path) {
      window.claude.pathsExist([project.path]).then(
        ([exists]) => done({ folderMissing: !exists }),
        (err) => console.error('vérification du dossier impossible', err),
      );
    }
  }

  // La suite part dans une copie : l'ancien .jsonl n'est jamais touché, les anciens messages restent affichés.
  const [resuming, setResuming] = useState(false);
  /** Reprend l'ancienne conversation affichée (dans une copie, l'original reste intact) et y envoie `text`. */
  async function continueViewing(text: string) {
    if (!viewing?.path || !viewing.items) return;
    const { id, key, path: cwd, items } = viewing;
    const title = displayTitle(viewing, organize.sessions[key]);
    if (resuming) return;
    setResuming(true);
    try {
      const sessionId = await window.claude.startSession(cwd, { model: launchModel(lastModel), forkFrom: id });
      setViewing(null);
      dispatch({ type: 'session-opened', sessionId, cwd, model: lastModel, title, items });
      void deliver({ id: sessionId, model: launchModel(lastModel), auto: lastModel === 'auto' }, text);
    } catch (err) {
      setViewing((v) => (v?.key === key ? { ...v, error: `Impossible de reprendre : ${err instanceof Error ? err.message : String(err)}` } : v));
    } finally {
      setResuming(false);
    }
  }

  function selectSession(sessionId: string) {
    closeArtifact();
    setSettingsOpen(false);
    setViewing(null);
    setProjectId(null);
    dispatch({ type: 'select', sessionId });
  }

  shortcuts.current = {
    newSession: () => {
      setSettingsOpen(false);
      void newSession();
    },
    search: () => {
      if (collapsed) toggleSidebar();
      // Après le rendu : la barre latérale dépliée doit exister.
      requestAnimationFrame(() => document.getElementById(HISTORY_SEARCH_ID)?.focus());
    },
    cycle: (step) => {
      const shown = viewing || shownProject || settingsOpen ? null : state.activeId;
      const next = neighborSession(state.sessions.map((s) => s.id), shown, step);
      if (next) selectSession(next);
    },
  };

  // Clic sur la notification « réponse terminée » : on affiche la session concernée.
  // Seulement des setters stables et closeArtifact (useCallback) : pas besoin de réabonner.
  useEffect(
    () =>
      window.claude.onFocusSession((sessionId) => {
        closeArtifact();
        setSettingsOpen(false);
        setViewing(null);
        setProjectId(null);
        dispatch({ type: 'select', sessionId });
      }),
    [closeArtifact],
  );

  /** Export Markdown ou PDF de la conversation affichée. */
  async function exportChat(format: 'md' | 'pdf', title: string, items: ChatItem[]) {
    try {
      const path =
        format === 'md'
          ? await window.claude.saveText(exportFileName(title, 'md'), toMarkdown(title, items, new Date()))
          : await window.claude.exportPdf(exportFileName(title, 'pdf'));
      if (path) setNotice(`Enregistré : ${path}`);
    } catch (err) {
      setNotice(`Export impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function saveArtifact(name: string, text: string) {
    try {
      const path = await window.claude.saveText(name, text);
      if (path) setNotice(`Enregistré : ${path}`);
    } catch (err) {
      setNotice(`Enregistrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function close(sessionId: string) {
    window.claude.stopSession(sessionId);
    dispatch({ type: 'session-closed', sessionId });
  }

  async function changeModel(model: ModelSetting | undefined) {
    if (!active) return;
    const sessionId = active.id;
    setLastModel(model);
    writeLastModel(localStorage, model);
    if (model === 'auto') {
      // Pas de relance tout de suite : le prochain message choisira.
      dispatch({ type: 'model-changed', sessionId, model: active.model, auto: true });
      return;
    }
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
    void deliver(active, text);
  }

  /** Affiche le message, choisit le modèle si la session est en Auto (relance si besoin), puis l'envoie. */
  async function deliver(session: Pick<SessionState, 'id' | 'model' | 'auto' | 'context'>, text: string) {
    const sessionId = session.id;
    dispatch({ type: 'user-sent', sessionId, text });
    if (session.auto) {
      try {
        const route = await window.claude.routeMessage(text, session.model, session.context?.used);
        dispatch({ type: 'routed', sessionId, route });
        if (route.model !== session.model) {
          await window.claude.setModel(sessionId, route.model);
          dispatch({ type: 'model-changed', sessionId, model: route.model, auto: true });
        }
      } catch (err) {
        // Pas de choix possible : on envoie quand même avec le modèle en cours.
        console.error('mode Auto indisponible', err);
      }
    }
    window.claude.sendMessage(sessionId, text);
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
      const setting = from.auto ? 'auto' : from.model;
      const model = launchModel(setting);
      const sessionId = await window.claude.startSession(from.cwd, { model });
      setHandoff(null);
      setSaving({ busy: false });
      dispatch({ type: 'session-opened', sessionId, cwd: from.cwd, model: setting });
      void deliver({ id: sessionId, model, auto: from.auto }, text);
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
    <div className="shell">
    <TitleBar onSettings={() => setSettingsOpen((o) => !o)} settingsOpen={settingsOpen} />
    <ArtifactContext.Provider value={openArtifact}>
    <div className={artifact && !settingsOpen && !shownProject ? 'app with-artifact' : 'app'}>
      <Sidebar
        sessions={state.sessions}
        activeId={viewing || shownProject || settingsOpen ? null : state.activeId}
        limits={state.limits}
        onNew={() => {
          setSettingsOpen(false);
          newSession();
        }}
        onSelect={selectSession}
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
          showTechnical={settings.showTechnical}
        />
      </Sidebar>
      {settingsOpen ? (
        <SettingsView
          settings={settings}
          router={router}
          onChange={changeSettings}
          onRouterChange={changeRouter}
          onClose={closeSettings}
        />
      ) : shownProject && projectId ? (
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
          folderMissing={viewing.folderMissing}
          actions={
            <ExportMenu
              disabled={!viewing.items?.length}
              onMarkdown={() => void exportChat('md', displayTitle(viewing, organize.sessions[viewing.key]), viewing.items ?? [])}
              onPdf={() => void exportChat('pdf', displayTitle(viewing, organize.sessions[viewing.key]), viewing.items ?? [])}
            />
          }
          composer={
            <Composer
              running={resuming}
              onSend={(text) => void continueViewing(text)}
              onStop={() => {}}
              onPickFiles={() => window.claude.pickFiles()}
              pathForFile={(f) => window.claude.pathForFile(f)}
              onSavePasted={(bytes, ext) => window.claude.savePastedImage(bytes, ext)}
              commands={state.commands}
              sendKey={settings.sendKey}
              {...promptProps}
            />
          }
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
            <ExportMenu
              disabled={active.items.length === 0}
              onMarkdown={() => void exportChat('md', active.title, active.items)}
              onPdf={() => void exportChat('pdf', active.title, active.items)}
            />
          </header>
          <ChatView
            items={active.items}
            running={active.status === 'running'}
            onPermission={(requestId, decision) => window.claude.answerPermission(active.id, requestId, decision)}
            onRetry={() => {
              const text = lastUserText(active.items);
              if (text) send(text);
            }}
          />
          {shouldSuggestHandoff(active, HANDOFF_THRESHOLD, { enabled: settings.autoHandoff, dismissed: handoffDismissed.has(active.id), phase: phase.phase }) && active.context && (
            <HandoffBanner
              percent={Math.round((active.context.used / active.context.max) * 100)}
              onHandoff={startHandoff}
              onDismiss={() => setHandoffDismissed((d) => new Set(d).add(active.id))}
            />
          )}
          <Composer running={active.status === 'running'} onSend={send} onStop={stop} onPickFiles={() => window.claude.pickFiles()} pathForFile={(f) => window.claude.pathForFile(f)}
            onSavePasted={(bytes, ext) => window.claude.savePastedImage(bytes, ext)} commands={state.commands} suggestion={active.suggestion}
            sendKey={settings.sendKey}
            {...promptProps}
            tools={
              <ModelPicker
                value={active.auto ? 'auto' : active.model}
                autoModel={active.model}
                route={active.route}
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
      {artifact && !settingsOpen && !shownProject && (
        <ArtifactPanel artifact={artifact} load={loadArtifact} onSave={(name, text) => void saveArtifact(name, text)} onClose={closeArtifact} width={artifactWidth} onResize={(w) => { setArtifactWidth(w); writeArtifactWidth(localStorage, w); }} />
      )}
    </div>
    </ArtifactContext.Provider>
    {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  );
}
