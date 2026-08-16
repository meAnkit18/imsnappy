/**
 * I'm Snappy — Scheduled page
 * Task scheduling for automated agent runs with time/recurrence controls.
 * Editorial off-white canvas, warm ink type.
 */
import { useState } from "react";
import { Clock, Repeat, CalendarDays, Plus, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";

type ScheduledTask = {
  id: string;
  name: string;
  description: string;
  time: string;
  recurrence: "daily" | "weekly" | "monthly" | "once";
  recurrenceLabel: string;
  enabled: boolean;
  nextRun: string;
  lastRun?: string;
};

const initialTasks: ScheduledTask[] = [
  {
    id: "t1",
    name: "Morning briefing",
    description: "Summarize overnight research and prepare a priority list for the day.",
    time: "7:00 AM",
    recurrence: "daily",
    recurrenceLabel: "Daily",
    enabled: true,
    nextRun: "Tomorrow, 7:00 AM",
    lastRun: "Today, 7:00 AM",
  },
  {
    id: "t2",
    name: "Weekly research digest",
    description: "Compile the week's key findings into a structured report and save to Library.",
    time: "Friday, 5:00 PM",
    recurrence: "weekly",
    recurrenceLabel: "Weekly",
    enabled: true,
    nextRun: "Fri, Aug 22, 5:00 PM",
    lastRun: "Fri, Aug 15, 5:00 PM",
  },
  {
    id: "t3",
    name: "Draft review pass",
    description: "Review all open Canvas drafts for consistency, tone, and completeness.",
    time: "12:00 PM",
    recurrence: "weekly",
    recurrenceLabel: "Weekly",
    enabled: false,
    nextRun: "Mon, Aug 18, 12:00 PM",
  },
  {
    id: "t4",
    name: "Calendar prep",
    description: "Read upcoming calendar events and prepare context notes for each.",
    time: "6:30 AM",
    recurrence: "daily",
    recurrenceLabel: "Daily",
    enabled: true,
    nextRun: "Tomorrow, 6:30 AM",
    lastRun: "Today, 6:30 AM",
  },
];

export default function ScheduledPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>(initialTasks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTime, setNewTime] = useState("9:00 AM");
  const [newRecurrence, setNewRecurrence] = useState<"daily" | "weekly" | "monthly" | "once">("daily");

  const recurrenceLabels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    once: "Once",
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, enabled: !t.enabled };
        toast.message(next.enabled ? `${t.name} enabled.` : `${t.name} paused.`, {
          description: next.enabled ? "The agent will run this on schedule." : "The task is paused until you re-enable it.",
        });
        return next;
      }),
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.message("Task removed.", { description: "The schedule has been updated." });
  };

  const handleAddTask = () => {
    const cleanName = newName.trim();
    const cleanDesc = newDescription.trim();
    if (!cleanName) {
      toast.message("Give the task a name first.");
      return;
    }
    setTasks((prev) => [
      ...prev,
      {
        id: `t${Date.now()}`,
        name: cleanName,
        description: cleanDesc || "No description provided.",
        time: newTime,
        recurrence: newRecurrence,
        recurrenceLabel: recurrenceLabels[newRecurrence],
        enabled: true,
        nextRun: "Scheduled",
      },
    ]);
    setNewName("");
    setNewDescription("");
    setShowAddForm(false);
    toast.message(`${cleanName} scheduled.`, { description: `Runs ${recurrenceLabels[newRecurrence].toLowerCase()} at ${newTime}.` });
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
          {recurrenceIcon(task.recurrence)}
        </span>
        <div className="scheduled-task-info">
          <span className="scheduled-task-name">{task.name}</span>
          <span className="scheduled-task-meta">
            <span>{task.description}</span>
          </span>
          <span className="scheduled-task-meta mt-1">
            <span className="flex items-center gap-1">
              <Clock size={11} /> {task.time}
            </span>
            <span className="flex items-center gap-1">
              {recurrenceIcon(task.recurrence)} {task.recurrenceLabel}
            </span>
            {task.lastRun && (
              <span className="flex items-center gap-1">
                Last run: {task.lastRun}
              </span>
            )}
          </span>
        </div>
        <div className="scheduled-task-controls">
          <button
            type="button"
            role="switch"
            aria-checked={task.enabled}
            aria-label={task.enabled ? `Pause ${task.name}` : `Enable ${task.name}`}
            onClick={() => toggleTask(task.id)}
            className={`scheduled-switch ${task.enabled ? "scheduled-switch-on" : ""}`}
          >
            <span className="scheduled-switch-thumb" />
          </button>
          <button
            type="button"
            onClick={() => deleteTask(task.id)}
            className="icon-button h-8 w-8"
            aria-label={`Delete ${task.name}`}
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
          <p className="text-[13px] text-[#4e4e4e]">
            Tasks the agent performs automatically at scheduled times. Enable or pause each task below.
          </p>
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
          <div className="mt-12 text-center">
            <p className="text-[14px] text-[#4e4e4e]">No scheduled tasks yet.</p>
            <p className="mt-2 text-[12px] text-[#8a857d]">
              Add one above and the agent will run it automatically.
            </p>
          </div>
        )}
      </div>
    </DiscoverLayout>
  );
}
