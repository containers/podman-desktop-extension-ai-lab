export type TaskState = 'loading' | 'error' | 'success'

export interface Task {
  id: string,
  state: TaskState;
  name: string;
}
