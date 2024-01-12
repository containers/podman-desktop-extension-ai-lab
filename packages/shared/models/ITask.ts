export type TaskState = 'loading' | 'error' | 'success'

export interface Task {
  id: string,
  state: TaskState;
  progress?: number
  name: string;
}
