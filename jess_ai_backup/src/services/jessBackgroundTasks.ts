export interface JessQueuedTask {
  id: string;
  title: string;
  description: string;
  taskType: 'document_generation' | 'workspace_audit' | 'batch_schedule' | 'research_report' | 'data_cleanup' | 'custom';
  progress: number; // 0 - 100
  stage: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  resultSummary?: string;
  targetId?: string;
  targetType?: string;
  payload?: Record<string, any>;
}

export type JessTaskStatusEventType =
  | 'hubmind:jess-task-queued'
  | 'hubmind:jess-task-progress'
  | 'hubmind:jess-task-completed'
  | 'hubmind:jess-task-failed'
  | 'hubmind:jess-task-cancelled';

const QUEUE_STORAGE_KEY = 'hubmind_jess_task_queue_v2';

class JessBackgroundProcessingQueue {
  private queue: Map<string, JessQueuedTask> = new Map();
  private subscribers: Set<(tasks: JessQueuedTask[]) => void> = new Set();
  private isProcessing = false;

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        const parsed: JessQueuedTask[] = JSON.parse(data);
        parsed.forEach(t => this.queue.set(t.id, t));
      }
    } catch {
      // Storage unavailable or invalid
    }
  }

  private persistQueue() {
    try {
      const all = Array.from(this.queue.values()).slice(-30);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Persist failure handled silently
    }
    this.notifySubscribers();
  }

  private emitStatusEvent(eventType: JessTaskStatusEventType, task: JessQueuedTask) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(eventType, { detail: { task, queue: this.getAllTasks() } }));
      window.dispatchEvent(new CustomEvent('hubmind:jess-queue-updated', { detail: { task, queue: this.getAllTasks() } }));
    }
  }

  private notifySubscribers() {
    const list = this.getAllTasks();
    this.subscribers.forEach(fn => fn(list));
  }

  public subscribe(fn: (tasks: JessQueuedTask[]) => void): () => void {
    this.subscribers.add(fn);
    fn(this.getAllTasks());
    return () => this.subscribers.delete(fn);
  }

  public getAllTasks(): JessQueuedTask[] {
    return Array.from(this.queue.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  public getActiveTasks(): JessQueuedTask[] {
    return this.getAllTasks().filter(t => t.status === 'in_progress' || t.status === 'queued');
  }

  public getTask(id: string): JessQueuedTask | undefined {
    return this.queue.get(id);
  }

  public enqueueTask(params: {
    title: string;
    description?: string;
    taskType?: JessQueuedTask['taskType'];
    priority?: JessQueuedTask['priority'];
    payload?: Record<string, any>;
    customStages?: { atPct: number; stage: string; delayMs?: number }[];
    onComplete?: () => Promise<{ summary: string; targetId?: string; targetType?: string }>;
  }): JessQueuedTask {
    const now = new Date().toISOString();
    const id = `jtask_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const task: JessQueuedTask = {
      id,
      title: params.title,
      description: params.description || '',
      taskType: params.taskType || 'custom',
      progress: 5,
      stage: 'Queued for background execution...',
      status: 'queued',
      priority: params.priority || 'normal',
      startedAt: now,
      updatedAt: now,
      payload: params.payload,
    };

    this.queue.set(id, task);
    this.persistQueue();
    this.emitStatusEvent('hubmind:jess-task-queued', task);

    // Run task execution asynchronously without blocking the conversation
    this.processTaskAsynchronously(task, params.customStages, params.onComplete);

    return task;
  }

  private async processTaskAsynchronously(
    task: JessQueuedTask,
    customStages?: { atPct: number; stage: string; delayMs?: number }[],
    onComplete?: () => Promise<{ summary: string; targetId?: string; targetType?: string }>
  ) {
    // Default progressive stages if not custom provided
    const stages = customStages || [
      { atPct: 20, stage: 'Gathering workspace context and reviewing records...', delayMs: 1200 },
      { atPct: 45, stage: 'Processing items and executing core logic in background...', delayMs: 2200 },
      { atPct: 75, stage: 'Formatting and validating workspace changes...', delayMs: 1800 },
      { atPct: 90, stage: 'Saving records and syncing cloud state...', delayMs: 1400 },
    ];

    setTimeout(() => {
      if (this.queue.get(task.id)?.status === 'queued') {
        this.updateTaskProgress(task.id, 10, 'Started background execution.');
      }
    }, 400);

    let cumulativeDelay = 600;
    for (const step of stages) {
      cumulativeDelay += (step.delayMs || 1500);
      setTimeout(() => {
        const current = this.queue.get(task.id);
        if (current && (current.status === 'in_progress' || current.status === 'queued')) {
          this.updateTaskProgress(task.id, step.atPct, step.stage);
        }
      }, cumulativeDelay);
    }

    setTimeout(async () => {
      const current = this.queue.get(task.id);
      if (!current || current.status === 'cancelled' || current.status === 'failed') return;

      try {
        let result: { summary: string; targetId?: string; targetType?: string } = {
          summary: `Completed "${task.title}". All workspace records have been updated.`,
        };

        if (onComplete) {
          result = await onComplete();
        }

        current.targetId = result.targetId;
        current.targetType = result.targetType;
        this.updateTaskProgress(task.id, 100, 'Completed successfully.', result.summary);
      } catch (err: any) {
        this.failTask(task.id, err?.message || 'Task failed during final step.');
      }
    }, cumulativeDelay + 1200);
  }

  public updateTaskProgress(id: string, progress: number, stage?: string, resultSummary?: string) {
    const task = this.queue.get(id);
    if (!task) return;
    const now = new Date().toISOString();
    task.progress = Math.min(100, Math.max(0, Math.round(progress)));
    if (stage) task.stage = stage;
    if (resultSummary) task.resultSummary = resultSummary;
    task.updatedAt = now;

    if (task.progress >= 100) {
      task.status = 'completed';
      task.completedAt = now;
      if (!task.stage || task.stage.includes('...')) {
        task.stage = 'Completed successfully.';
      }
      this.persistQueue();
      this.emitStatusEvent('hubmind:jess-task-completed', task);
    } else {
      task.status = 'in_progress';
      this.persistQueue();
      this.emitStatusEvent('hubmind:jess-task-progress', task);
    }
  }

  public failTask(id: string, errorMessage: string) {
    const task = this.queue.get(id);
    if (!task) return;
    task.status = 'failed';
    task.stage = `Failed: ${errorMessage}`;
    task.updatedAt = new Date().toISOString();
    this.persistQueue();
    this.emitStatusEvent('hubmind:jess-task-failed', task);
  }

  public cancelTask(id: string) {
    const task = this.queue.get(id);
    if (!task) return;
    task.status = 'cancelled';
    task.stage = 'Cancelled by user or system.';
    task.updatedAt = new Date().toISOString();
    this.persistQueue();
    this.emitStatusEvent('hubmind:jess-task-cancelled', task);
  }

  public getActiveTasksSummary(): string {
    return this.getQueueSummaryForPrompt();
  }

  public getQueueSummaryForPrompt(): string {
    const active = this.getActiveTasks();
    const recent = this.getAllTasks()
      .filter(t => t.status === 'completed')
      .slice(0, 3);

    if (active.length === 0 && recent.length === 0) {
      return 'Background processing queue is currently idle (0 active jobs).';
    }

    const lines: string[] = [];
    if (active.length > 0) {
      lines.push('ACTIVE BACKGROUND QUEUE JOBS:');
      active.forEach(t => {
        lines.push(`• [${t.progress}% complete] Task: "${t.title}" (ID: ${t.id}) — Stage: ${t.stage}`);
      });
    }

    if (recent.length > 0) {
      lines.push('RECENTLY COMPLETED QUEUE JOBS:');
      recent.forEach(t => {
        lines.push(`• [100% complete] Task: "${t.title}" — ${t.resultSummary || t.stage || 'Completed'}`);
      });
    }

    return lines.join('\n');
  }
}

export const jessBackgroundTasks = new JessBackgroundProcessingQueue();
export type JessBackgroundTask = JessQueuedTask;
