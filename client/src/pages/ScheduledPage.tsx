/**
 * I'm Snappy — Scheduled page
 * Task scheduling for automated agent runs with time/recurrence controls.
 * Editorial off-white canvas, warm ink type.
 */
import { useEffect, useState } from "react";
import { Clock, Repeat, CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { listSchedules, saveSchedules, type ScheduledTask } from "@/lib/localStore";
import { trpc } from "@/lib/trpc";

const RECURRENCE_MINUTES: Record<string, number> = { daily: 1440, weekly: 10080, monthly: 43200 };
const RECURRENCE_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", once: "Once" };

function computeNextRun(task: ScheduledTask): string {
  if (!task.enabled) return "—";
  const target = new Date(task.nextRunAt);
  const now = new Date();
  if (target.getTime() <= now.getTime()) {
    const minutes = RECURRENCE_MINUTES[task.interval] ?? RECURRENCE_MINUTES.daily;
    target.setTime(target.getTime() + minutes * 60 * 1000);
    if (target.getTime() <= now.getTime()) {
      // Avoid a missed-run spiral for one-shot or long-overdue tasks.
      target.setTime(now.getTime() + minutes * 60 * 1000);
    }
    task.nextRunAt = target.toISOString();
  }
  return target.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function refreshNextRun(task: ScheduledTask): ScheduledTask {
  computeNextRun(task);
  return task;
}

export default function ScheduledPage() {
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: 0 });
  const isSignedIn = Boolean(me?.openId);
  const utils = trpc.useUtils();
  const { data: serverTasks } = trpc.schedules.list.useQuery(undefined, { enabled: isSignedIn, retry: 0 });
  const upsertTask = trpc.schedules.upsert.useMutation({
    onSuccess: () => utils.schedules.list.invalidate(),
  });
  const removeTask = trpc.schedules.remove.useMutation({
    onSuccess: () => utils.schedules.list.invalidate(),
  });

  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  useEffect(() => {
    setTasks((serverTasks && isSignedIn ? serverTasks : listSchedules()).map(refreshNextRun));
  }, [serverTasks, isSignedIn]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTime, setNewTime] = useState("9:00 AM");
  const [newRecurrence, setNewRecurrence] = useState<"daily" | "weekly" | "monthly" | "once">("daily");

  const persist = (updated: ScheduledTask[]) => {
    updated.forEach(computeNextRun);
    if (isSignedIn) {
      updated.forEach((task) =>
        upsertTask.mutate({
          publicId: task.id,
          title: task.title,
          description: task.description || undefined,
          interval: task.interval,
          intervalMinutes: task.intervalMinutes,
          enabled: task.enabled,
          nextRunAt: task.nextRunAt,
        }),
      );
      toast.message("Saved to the server.", { description: "The deployed scheduler will pick these tasks up once online." });
    } else {
      saveSchedules(updated);
      toast.message("Saved on this device.", { description: "The deployed scheduler will take over these tasks once the backend is live." });
    }
    setTasks(updated);
  };

  const toggleTask = (id: string) => {
    persist(tasks.map((task) => (task.id === id ? { ...task, enabled: !task.enabled } : task)));
    const target = tasks.find((task) => task.id === id);
    if (target) {
      toast.message(target.enabled ? `${target.title} paused.` : `${target.title} enabled.`, {
        description: target.enabled ? "The local agent will no longer run this on schedule." : "The task is queued locally until it re-enables.",
      });
    }
  };

  const deleteTask = (id: string) => {
    const target = tasks.find((task) => task.id === id);
    if (isSignedIn && target) {
      removeTask.mutate({ publicId: id });
    }
    persist(tasks.filter((task) => task.id !== id));
    toast.message("Task removed.", { description: `${target?.title ?? "The schedule"} has been deleted${isSignedIn ? " from the server" : " from this device"}.` });
  };

  const handleAddTask = () => {
    const cleanName = newName.trim();
    const cleanDesc = newDescription.trim();
    if (!cleanName) {
      toast.message("Give the task a name first.");
      return;
    }
    const firstRun = new Date();
    firstRun.setSeconds(0, 0);
    firstRun.setHours(Number.parseInt(newTime.split(":")[0], 10) % 12, Number.parseInt((newTime.split(":")[1] ?? "00").slice(0, 2), 10));
    if (newTime.toLowerCase().includes("pm") && Number.parseInt(newTime.split(":")[0], 10) % 12 !== 0) firstRun.setHours(firstRun.getHours() + 12);
    if (firstRun.getTime() <= Date.now()) firstRun.setDate(firstRun.getDate() + 1);
    const minutes = RECURRENCE_MINUTES[newRecurrence] ?? RECURRENCE_MINUTES.daily;
    const task: ScheduledTask = {
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: cleanName,
      description: cleanDesc,
      interval: newRecurrence,
      intervalMinutes: minutes,
      enabled: true,
      lastRunAt: null,
      nextRunAt: firstRun.toISOString(),
      createdAt: new Date().toISOString(),
    };
    persist([task, ...tasks]);
    setNewName("");
    setNewDescription("");
    setShowAddForm(false);
    toast.message(`${cleanName} scheduled.`, {
      description: `Runs ${RECURRENCE_LABELS[newRecurrence].toLowerCase()} at ${newTime} in this preview.`,
    });
  };

  const recurrenceIcon = (rec: string) => {
    switch (rec) {
      case "daily":
      case "weekly":
      case "monthly":
        return <Repeat size={13} />;
      case "once":
        return <CalendarDays size={13} />;
      default:
        return <Clock size={13} />;
    }
  };

  const enabledTasks = tasks.filter((t) => t.enabled);
  const pausedTasks = tasks.filter((t) => !t.enabled);

  const renderTaskList = (list: ScheduledTask[]) =>
    list.map((task) => (
      <div key={task.id} className="scheduled-task-card">
        <span className="scheduled-task-icon">
          {recurrenceIcon(task.interval)}
        </span>
        <div className="scheduled-task-info">
            <span className="scheduled-task-name">{task.title}</span>
          {task.description ? (
            <span className="mt-1 block max-w-md text-[12px] leading-5 text-[#8b857c]">{task.description}</span>
          ) : null}
          <span className="scheduled-task-meta mt-1">
            <span className="flex items-center gap-1">
              <Clock size={11} /> {computeNextRun(task)}
            </span>
            <span className="flex items-center gap-1">
              {recurrenceIcon(task.interval)} {RECURRENCE_LABELS[task.interval] ?? task.interval}
            </span>
            {task.lastRunAt && (
              <span className="flex items-center gap-1">
                Last run: {new Date(task.lastRunAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </span>
        </div>
        <div className="scheduled-task-controls">
          <button
            type="button"
            role="switch"
            aria-checked={task.enabled}
            aria-label={task.enabled ? `Pause ${task.title}` : `Enable ${task.title}`}
            onClick={() => toggleTask(task.id)}
            className={`scheduled-switch ${task.enabled ? "scheduled-switch-on" : ""}`}
          >
            <span className="scheduled-switch-thumb" />
          </button>
          <button
            type="button"
            onClick={() => deleteTask(task.id)}
            className="icon-button h-8 w-8"
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    ));

  return (
    <DiscoverLayout page="scheduled">
      <div className="max-w-2xl">
          <div className="mb-6">
          <p className="font-serif text-[28px] font-light tracking-[-0.035em] text-[#292524]">Hold a useful rhythm.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#777169]">Set work in motion, then keep it visible. Enable or pause each task below as the rhythm changes.</p>
        </div>

        {enabledTasks.length > 0 && (
          <div className="mb-8">
            <p className="settings-section-label mb-3">Active ({enabledTasks.length})</p>
            {renderTaskList(enabledTasks)}
          </div>
        )}

        {pausedTasks.length > 0 && (
          <div className="mb-8">
            <p className="settings-section-label mb-3">Paused ({pausedTasks.length})</p>
            {renderTaskList(pausedTasks)}
          </div>
        )}

        {showAddForm ? (
          <div className="border border-[#e7e5e4] border-radius-12 rounded-xl bg-white p-5">
            <p className="settings-section-label mb-4">New scheduled task</p>
            <div className="settings-field">
              <label className="settings-field-label" htmlFor="task-name">Task name</label>
              <input
                id="task-name"
                type="text"
                className="settings-input"
                placeholder="e.g. Daily research digest"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label" htmlFor="task-desc">Description</label>
              <textarea
                id="task-desc"
                className="settings-textarea"
                placeholder="What should the agent do when this runs?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="settings-field flex-1">
                <label className="settings-field-label" htmlFor="task-time">Time</label>
                <input
                  id="task-time"
                  type="text"
                  className="settings-input"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                />
              </div>
              <div className="settings-field flex-1">
                <label className="settings-field-label" htmlFor="task-recurrence">Recurrence</label>
                <select
                  id="task-recurrence"
                  className="settings-select"
                  value={newRecurrence}
                  onChange={(e) => setNewRecurrence(e.target.value as "daily" | "weekly" | "monthly" | "once")}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="once">Once</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button type="button" className="api-key-save" onClick={handleAddTask}>
                Add task
              </button>
              <button
                type="button"
                className="settings-input text-center cursor-pointer"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="scheduled-add-card" onClick={() => setShowAddForm(true)}>
            <Plus size={16} />
            Schedule a new task
          </button>
        )}

        {tasks.length === 0 && (
          <div className="folio-empty-state mt-10">
            <span className="folio-empty-index">Rhythm 01</span>
            <Clock size={24} strokeWidth={1.35} />
            <p className="folio-empty-title">No work is waiting in the wings.</p>
            <p className="folio-empty-copy">Add a task above to rehearse the cadence here. It is stored on this device until the deployed scheduler takes over.</p>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}
