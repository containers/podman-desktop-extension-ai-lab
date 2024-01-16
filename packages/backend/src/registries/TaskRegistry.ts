import { Task } from '@shared/models/ITask';

export class TaskRegistry {
  private tasks: Map<string, Task> = new Map<string, Task>();

  getTasksByLabel(label: string): Task[] {
    return Array.from(this.tasks.values())
      .filter((task) => label in (task.labels || {}))
  }

  set(task: Task) {
    this.tasks.set(task.id, task);
  }

  delete(taskId: string) {
    this.tasks.delete(taskId);
  }
}
