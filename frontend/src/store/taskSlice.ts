import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Task {
  id: number;
  type: string;
  data: string;
  status: string;
  priority: string;
  assigned_to_id: number | null;
  assigned_to?: { id: number; username: string; role: string } | null;
  cost: number;
  import_source: string;
  annotations?: any[];
}

interface TaskState {
  tasks: Task[];
  activeTask: Task | null;
  loading: boolean;
  error: string | null;
}

const initialState: TaskState = {
  tasks: [],
  activeTask: null,
  loading: false,
  error: null,
};

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    fetchTasksStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchTasksSuccess(state, action: PayloadAction<Task[]>) {
      state.tasks = action.payload;
      state.loading = false;
    },
    fetchTasksFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setActiveTask(state, action: PayloadAction<Task | null>) {
      state.activeTask = action.payload;
    },
    updateTaskStatus(state, action: PayloadAction<{ id: number; status: string }>) {
      const task = state.tasks.find(t => t.id === action.payload.id);
      if (task) {
        task.status = action.payload.status;
      }
      if (state.activeTask && state.activeTask.id === action.payload.id) {
        state.activeTask.status = action.payload.status;
      }
    },
  },
});

export const {
  fetchTasksStart,
  fetchTasksSuccess,
  fetchTasksFailure,
  setActiveTask,
  updateTaskStatus,
} = taskSlice.actions;

export default taskSlice.reducer;
