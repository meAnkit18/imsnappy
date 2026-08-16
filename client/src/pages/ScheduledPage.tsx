/**
 * I’m Snappy — Scheduled page
 * Durable task scheduling backed by the authenticated API and the lease-based worker.
 */
import { useEffect, useState } from "react";
import { CalendarDays, Clock, LoaderCircle, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { type Schedule } from "@/lib/api";
import { useApiSession } from "@/contexts/ApiSessionContext";

type Recurrence = "daily" | "weekly" | "monthly" | "once";
const intervals: Record<Recurrence, number | undefined> = { daily: 1_440, weekly: 10_080, monthly: 43_200, once: undefined };
const recurrenceLabels: Record<Recurrence, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", once: "One time" };

function nextLocalInputValue(): string {
  const date = new Date(Date.now() + 15 * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function recurrenceFor(schedule: Schedule): Recurrence {
  if (!schedule.intervalMinutes) return "once";
  if (schedule.intervalMinutes === intervals.daily) return "daily";
  if (schedule.intervalMinutes === intervals.weekly) return "weekly";
  return "monthly";
}

function scheduleTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Scheduled" : date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ScheduledPage() {
  const { api, session } = useApiSession();
  const [tasks, setTasks] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newTime, setNewTime] = useState(nextLocalInputValue);
  const [newRecurrence, setNewRecurrence] = useState<Recurrence>("daily");

  const refresh = async () => {
    if (!api.configured || !session) return;
    setLoading(true);
    try { const { schedules } = await api.listSchedules(); setTasks(schedules); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not load scheduled tasks."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [api, session]);

  const toggleTask = async (task: Schedule) => {
    try {
      const { schedule } = await api.updateSchedule(task.id, { enabled: !task.enabled });
      setTasks((current) => current.map((item) => item.id === task.id ? schedule : item));
      toast.message(schedule.enabled ? `${schedule.name} enabled.` : `${schedule.name} paused.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update this schedule."); }
  };

  const deleteTask = async (task: Schedule) => {
    try {
      await api.deleteSchedule(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      toast.message("Task removed.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not remove this schedule."); }
  };

  const handleAddTask = async () => {
    if (!session) { toast.error("Sign in in Settings before creating an automated task."); return; }
    const name = newName.trim();
    const prompt = newPrompt.trim();
    if (!name || !prompt) { toast.error("Add a task name and a clear agent instruction."); return; }
    const nextRun = new Date(newTime);
    if (Number.isNaN(nextRun.getTime()) || nextRun.getTime() <= Date.now()) { toast.error("Choose a future time for this task."); return; }
    setSubmitting(true);
    try {
      const { schedule } = await api.createSchedule({
        name,
        prompt,
        modelId: "deepseek-v4-flash-free",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        nextRunAt: nextRun.toISOString(),
        intervalMinutes: intervals[newRecurrence],
        enabled: true,
      });
      setTasks((current) => [...current, schedule].sort((left, right) => new Date(left.nextRunAt).getTime() - new Date(right.nextRunAt).getTime()));
      setNewName(""); setNewPrompt(""); setNewTime(nextLocalInputValue()); setShowAddForm(false);
      toast.success(`${schedule.name} is scheduled.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create this schedule."); }
    finally { setSubmitting(false); }
  };

  const recurrenceIcon = (recurrence: Recurrence) => recurrence === "once" ? <CalendarDays size={13} /> : <Repeat size={13} />;
  const enabledTasks = tasks.filter((task) => task.enabled);
  const pausedTasks = tasks.filter((task) => !task.enabled);
  const renderTaskList = (list: Schedule[]) => list.map((task) => {
    const recurrence = recurrenceFor(task);
    return <div key={task.id} className="scheduled-task-card">
      <span className="scheduled-task-icon">{recurrenceIcon(recurrence)}</span>
      <div className="scheduled-task-info">
        <span className="scheduled-task-name">{task.name}</span>
        <span className="scheduled-task-meta"><span>{task.prompt}</span></span>
        <span className="scheduled-task-meta mt-1"><span className="flex items-center gap-1"><Clock size={11} /> {scheduleTime(task.nextRunAt)}</span><span className="flex items-center gap-1">{recurrenceIcon(recurrence)} {recurrenceLabels[recurrence]}</span></span>
      </div>
      <div className="scheduled-task-controls">
        <button type="button" role="switch" aria-checked={task.enabled} aria-label={task.enabled ? `Pause ${task.name}` : `Enable ${task.name}`} onClick={() => void toggleTask(task)} className={`scheduled-switch ${task.enabled ? "scheduled-switch-on" : ""}`}><span className="scheduled-switch-thumb" /></button>
        <button type="button" onClick={() => void deleteTask(task)} className="icon-button h-8 w-8" aria-label={`Delete ${task.name}`}><Trash2 size={14} /></button>
      </div>
    </div>;
  });

  return (
    <DiscoverLayout page="scheduled">
      <div className="max-w-2xl">
        <div className="mb-6"><p className="text-[13px] text-[#4e4e4e]">Tasks run in the background at their scheduled time. The worker uses durable leases and idempotency keys so each planned execution is claimed safely.</p></div>
        {!api.configured && <p className="mb-6 text-[13px] text-[#8a857d]">Set <code>VITE_API_BASE_URL</code> to connect schedules to the I’m Snappy worker.</p>}
        {api.configured && !session && <p className="mb-6 text-[13px] text-[#8a857d]">Sign in through Settings to manage your private schedules.</p>}
        {loading && <div className="flex items-center gap-2 py-10 text-[13px] text-[#8a857d]"><LoaderCircle size={15} className="animate-spin" /> Loading schedules…</div>}
        {!loading && session && <>
          {enabledTasks.length > 0 && <div className="mb-8"><p className="settings-section-label mb-3">Active ({enabledTasks.length})</p>{renderTaskList(enabledTasks)}</div>}
          {pausedTasks.length > 0 && <div className="mb-8"><p className="settings-section-label mb-3">Paused ({pausedTasks.length})</p>{renderTaskList(pausedTasks)}</div>}
          {showAddForm ? <div className="border border-[#e7e5e4] border-radius-12 rounded-xl bg-white p-5">
            <p className="settings-section-label mb-4">New scheduled task</p>
            <div className="settings-field"><label className="settings-field-label" htmlFor="task-name">Task name</label><input id="task-name" className="settings-input" placeholder="e.g. Daily research digest" value={newName} onChange={(event) => setNewName(event.target.value)} /></div>
            <div className="settings-field"><label className="settings-field-label" htmlFor="task-prompt">Agent instruction</label><textarea id="task-prompt" className="settings-textarea" placeholder="What should the agent do when this runs?" value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} /></div>
            <div className="flex gap-3"><div className="settings-field flex-1"><label className="settings-field-label" htmlFor="task-time">First run</label><input id="task-time" type="datetime-local" className="settings-input" value={newTime} onChange={(event) => setNewTime(event.target.value)} /></div><div className="settings-field flex-1"><label className="settings-field-label" htmlFor="task-recurrence">Recurrence</label><select id="task-recurrence" className="settings-select" value={newRecurrence} onChange={(event) => setNewRecurrence(event.target.value as Recurrence)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">One time</option></select></div></div>
            <div className="flex items-center gap-3 mt-2"><button type="button" disabled={submitting} className="api-key-save flex items-center gap-2" onClick={() => void handleAddTask()}>{submitting && <LoaderCircle size={13} className="animate-spin" />} Add task</button><button type="button" className="settings-input text-center cursor-pointer" onClick={() => setShowAddForm(false)}>Cancel</button></div>
          </div> : <button type="button" className="scheduled-add-card" onClick={() => setShowAddForm(true)}><Plus size={16} /> Schedule a new task</button>}
          {tasks.length === 0 && <div className="mt-12 text-center"><p className="text-[14px] text-[#4e4e4e]">No scheduled tasks yet.</p><p className="mt-2 text-[12px] text-[#8a857d]">Create one above and the agent will perform it at the selected time.</p></div>}
        </>}
      </div>
    </DiscoverLayout>
  );
}
