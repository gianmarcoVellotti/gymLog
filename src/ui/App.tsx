import { useEffect } from 'react';
import { autoCloseStaleSession, getActiveSession } from '../services/sessions';
import { DialogProvider, useDialogs } from './components/Dialogs';
import { SessionDock } from './components/SessionDock';
import { TabBar } from './components/TabBar';
import { useLive } from './hooks/useLive';
import { matchPath, usePath } from './router';
import { CalendarView } from './views/CalendarView';
import { DayEditorView } from './views/DayEditorView';
import { DayPreviewView } from './views/DayPreviewView';
import { ExerciseDetailView } from './views/ExerciseDetailView';
import { ExerciseEditorView } from './views/ExerciseEditorView';
import { ExercisesView } from './views/ExercisesView';
import { MoreView } from './views/MoreView';
import { MuscleGroupsView } from './views/MuscleGroupsView';
import { ProgramDetailView } from './views/ProgramDetailView';
import { ProgramsView } from './views/ProgramsView';
import { SessionDetailView } from './views/SessionDetailView';
import { SessionView } from './views/SessionView';
import { TodayView } from './views/TodayView';

/** Chiude da sola la sessione ferma da più di 1 h (all'avvio, quando torni sull'app e ogni minuto). */
function useAutoClose() {
  const { toast } = useDialogs();
  useEffect(() => {
    const check = () => {
      void autoCloseStaleSession().then((r) => {
        if (r === 'closed') toast('Allenamento chiuso automaticamente: 1 ora senza attività. Puoi correggere l\'orario di fine.');
        if (r === 'discarded') toast('Allenamento senza serie scartato dopo 1 ora di inattività.');
      });
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', check);
    const id = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', check);
      window.clearInterval(id);
    };
  }, [toast]);
}

function Shell() {
  const path = usePath();
  const active = useLive(async () => ({ s: await getActiveSession() }), []);
  useAutoClose();

  const m = <T extends string>(pattern: string) => matchPath(pattern, path) as Record<T, string> | null;
  const inSession = path === '/session';
  const hasSession = !!active?.s;

  const exerciseEditor = m<'pid' | 'did' | 'peid'>('/programs/:pid/day/:did/exercise/:peid');
  const dayPreview = m<'dayId'>('/day/:dayId');
  const hideTabs = !!exerciseEditor || !!dayPreview;

  let view;
  const day = m<'pid' | 'did'>('/programs/:pid/day/:did');
  const program = m<'pid'>('/programs/:pid');
  const sessionDetail = m<'id'>('/sessions/:id');
  const exerciseDetail = m<'id'>('/more/exercises/:id');
  if (path === '/') view = <TodayView />;
  else if (dayPreview) view = <DayPreviewView dayId={dayPreview.dayId} />;
  else if (inSession) view = <SessionView />;
  else if (sessionDetail) view = <SessionDetailView sessionId={sessionDetail.id} />;
  else if (path === '/programs') view = <ProgramsView />;
  else if (exerciseEditor) view = <ExerciseEditorView programId={exerciseEditor.pid} dayId={exerciseEditor.did} peId={exerciseEditor.peid} />;
  else if (day) view = <DayEditorView programId={day.pid} dayId={day.did} />;
  else if (program) view = <ProgramDetailView programId={program.pid} />;
  else if (path === '/calendar') view = <CalendarView />;
  else if (path === '/more') view = <MoreView />;
  else if (path === '/more/exercises') view = <ExercisesView />;
  else if (exerciseDetail) view = <ExerciseDetailView id={exerciseDetail.id} />;
  else if (path === '/more/groups') view = <MuscleGroupsView />;
  else view = <TodayView />;

  return (
    <div className={`app ${hideTabs ? 'no-tabs' : ''} ${hasSession && !hideTabs ? 'with-dock' : ''}`}>
      {view}
      {hasSession && !inSession && !exerciseEditor && !dayPreview && <SessionDock mode="mini" />}
      {inSession && <SessionDock mode="full" />}
      {!hideTabs && <TabBar path={path} />}
    </div>
  );
}

export function App() {
  return (
    <DialogProvider>
      <Shell />
    </DialogProvider>
  );
}
