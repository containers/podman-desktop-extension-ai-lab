export type TaskState = 'loading' | 'error' | 'success';

export interface Task {
  id: string;
  state: TaskState;
  progress?: number;
  error?: string;
  name: string;
  labels?: { [id: string]: string };
}
