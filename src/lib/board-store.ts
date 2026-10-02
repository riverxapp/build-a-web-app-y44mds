import { useCallback, useEffect, useState } from "react";

export type ColumnId = "backlog" | "todo" | "in-progress" | "review" | "done";

export const COLUMNS: { id: ColumnId; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "bg-slate-400" },
  { id: "todo", title: "To Do", color: "bg-blue-500" },
  { id: "in-progress", title: "In Progress", color: "bg-amber-500" },
  { id: "review", title: "Review", color: "bg-purple-500" },
  { id: "done", title: "Done", color: "bg-emerald-500" },
];

export type Priority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  column: ColumnId;
  createdAt: number;
}

const STORAGE_KEY = "jira-clone-board";

const seed: Task[] = [
  { id: "t-1", title: "Set up project skeleton", description: "Vite + React + Tailwind", priority: "high", column: "done", createdAt: Date.now() - 5000 },
  { id: "t-2", title: "Design board layout", description: "Five columns, cards, drag & drop", priority: "medium", column: "review", createdAt: Date.now() - 4000 },
  { id: "t-3", title: "Implement drag & drop", description: "Native HTML5 drag events", priority: "high", column: "in-progress", createdAt: Date.now() - 3000 },
  { id: "t-4", title: "Add task editing", description: "Inline dialog with title, description, priority", priority: "medium", column: "todo", createdAt: Date.now() - 2000 },
  { id: "t-5", title: "Persistent storage", description: "Save board to localStorage", priority: "low", column: "todo", createdAt: Date.now() - 1000 },
  { id: "t-6", title: "Explore dark mode", description: "Maybe next-themes", priority: "low", column: "backlog", createdAt: Date.now() },
];

function load(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Task[];
  } catch {
    // ignore corrupt storage
  }
  return seed;
}

export function useBoard() {
  const [tasks, setTasks] = useState<Task[]>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const addTask = useCallback((title: string, description: string, priority: Priority, column: ColumnId) => {
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title, description, priority, column, createdAt: Date.now() },
    ]);
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Omit<Task, "id">>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const moveTask = useCallback((id: string, column: ColumnId, beforeId: string | null) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const rest = prev.filter((t) => t.id !== id);
      const moved = { ...task, column };
      if (!beforeId) {
        const colTasks = rest.filter((t) => t.column === column);
        if (colTasks.length === 0) return [...rest, moved];
        const lastIdx = rest.indexOf(colTasks[colTasks.length - 1]);
        return [...rest.slice(0, lastIdx + 1), moved, ...rest.slice(lastIdx + 1)];
      }
      const idx = rest.findIndex((t) => t.id === beforeId);
      if (idx === -1) return [...rest, moved];
      return [...rest.slice(0, idx), moved, ...rest.slice(idx)];
    });
  }, []);

  const resetBoard = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTasks(seed);
  }, []);

  return { tasks, addTask, updateTask, deleteTask, moveTask, resetBoard };
}

export function nextId(tasks: Task[]): string {
  const nums = tasks
    .map((t) => parseInt(t.id.replace(/\D+/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return `t-${(nums.length ? Math.max(...nums) : 0) + 1}`;
}
