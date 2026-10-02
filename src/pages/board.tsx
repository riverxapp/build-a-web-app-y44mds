import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLUMNS, useBoard, type ColumnId, type Priority, type Task } from "@/lib/board-store";
import { Trash2, Pencil, Plus } from "lucide-react";

const priorityStyles: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

const priorityLabels: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, description: string, priority: Priority, column: ColumnId) => void;
  task?: Task | null;
}

function TaskDialog({ open, onClose, onSave, task }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [column, setColumn] = useState<ColumnId>(task?.column ?? "backlog");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Select value={column} onValueChange={(v) => setColumn(v as ColumnId)}>
              <SelectTrigger>
                <SelectValue placeholder="Column" />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              onSave(title.trim(), description.trim(), priority, column);
              onClose();
            }}
          >
            {task ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function TaskCard({ task, onEdit, onDelete, onDragStart }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Edit task"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Delete task"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityStyles[task.priority]}`}
        >
          {priorityLabels[task.priority]}
        </span>
      </div>
    </div>
  );
}

export function BoardPage() {
  const { tasks, addTask, updateTask, deleteTask, moveTask, resetBoard } = useBoard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);

  const openNew = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded bg-blue-600 text-sm font-bold text-white">
            J
          </div>
          <h1 className="text-lg font-semibold">Jira Clone</h1>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" /> New Task
        </Button>
      </header>

      <main className="flex flex-1 gap-4 overflow-x-auto p-6">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.id);
          return (
            <section
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCol(col.id);
              }}
              onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                if (dragging) moveTask(dragging.id, col.id, null);
                setDragging(null);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 p-3 transition-colors ${
                dragOverCol === col.id ? "border-blue-400 bg-blue-50/50" : ""
              }`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`size-2 rounded-full ${col.color}`} />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {col.title}
                </h2>
                <span className="ml-auto rounded-full bg-muted px-2 text-xs text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={() => openEdit(task)}
                    onDelete={() => deleteTask(task.id)}
                    onDragStart={() => setDragging(task)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>

      {dialogOpen && (
        <TaskDialog
          open={dialogOpen}
          task={editingTask}
          onClose={() => setDialogOpen(false)}
          onSave={(title, description, priority, column) => {
            if (editingTask) {
              updateTask(editingTask.id, { title, description, priority, column });
            } else {
              addTask(title, description, priority, column);
            }
          }}
        />
      )}
    </div>
  );
}
