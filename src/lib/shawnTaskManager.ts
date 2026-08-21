// Background Task and Live Event Manager for Shawn AI
export interface ShawnTask {
  id: string;
  type: 'document_edit' | 'document_create' | 'task_generation' | 'calendar_sync' | 'analysis';
  title: string;
  status: 'running' | 'completed' | 'failed' | 'awaiting_approval';
  progress: number; // 0 to 100
  currentStepMessage: string;
  documentId?: string;
  documentTitle?: string;
  proposedContent?: string;
  originalContent?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

type TaskListener = (tasks: ShawnTask[]) => void;

class ShawnTaskManager {
  private tasks: Map<string, ShawnTask> = new Map();
  private listeners: Set<TaskListener> = new Set();

  constructor() {
    // Listen for custom browser events for cross-tab or cross-component sync
    if (typeof window !== 'undefined') {
      window.addEventListener('shawn:task_update_internal', (e: any) => {
        if (e.detail) {
          this.tasks.set(e.detail.id, e.detail);
          this.notify();
        }
      });
    }
  }

  public subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllTasks());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const all = this.getAllTasks();
    this.listeners.forEach((fn) => fn(all));
  }

  public getAllTasks(): ShawnTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getActiveTasks(): ShawnTask[] {
    return this.getAllTasks().filter((t) => t.status === 'running' || t.status === 'awaiting_approval');
  }

  public getTask(id: string): ShawnTask | undefined {
    return this.tasks.get(id);
  }

  public createTask(task: Omit<ShawnTask, 'id' | 'createdAt'> & { id?: string }): ShawnTask {
    const id = task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTask: ShawnTask = {
      ...task,
      id,
      createdAt: Date.now(),
    };
    this.tasks.set(id, newTask);
    this.notify();
    this.broadcastEvent('shawn:task_created', newTask);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<ShawnTask>) {
    const existing = this.tasks.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    if (updates.status === 'completed' || updates.status === 'failed') {
      updated.completedAt = Date.now();
    }
    this.tasks.set(id, updated);
    this.notify();
    this.broadcastEvent('shawn:task_updated', updated);
  }

  public removeTask(id: string) {
    this.tasks.delete(id);
    this.notify();
  }

  public broadcastEvent(name: string, payload: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(name, { detail: payload }));
    }
  }
}

export const shawnTaskManager = new ShawnTaskManager();
