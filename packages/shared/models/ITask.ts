
export interface Task {
  state: 'loading' | 'error' | 'success';
  name: string;
}
