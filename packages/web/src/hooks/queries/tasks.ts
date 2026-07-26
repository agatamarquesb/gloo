import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateTaskInput,
  SubtaskDto,
  TaskBySectorDto,
  TaskDetailDto,
  TaskFilters,
  TaskListItemDto,
  TaskSummaryDto,
  UpdateTaskInput,
} from '@gloo/shared';

import { apiClient } from '@/lib/apiClient';
import { taskKeys } from '@/lib/queryKeys';

function toQueryString(filters: TaskFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => apiClient.get<TaskListItemDto[]>(`/tasks${toQueryString(filters)}`),
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => apiClient.get<TaskDetailDto>(`/tasks/${id}`),
    enabled: !!id,
  });
}

export function useTaskSummary(assigneeId?: string) {
  return useQuery({
    queryKey: taskKeys.summary(assigneeId),
    queryFn: () =>
      apiClient.get<TaskSummaryDto>(`/tasks/summary${assigneeId ? `?assigneeId=${assigneeId}` : ''}`),
  });
}

export function useTasksBySector() {
  return useQuery({
    queryKey: taskKeys.bySector,
    queryFn: () => apiClient.get<TaskBySectorDto[]>('/tasks/by-sector'),
  });
}

export function useTasksCalendar(from: string, to: string) {
  return useQuery({
    queryKey: taskKeys.calendar(from, to),
    queryFn: () =>
      apiClient.get<{ date: string; sectorIds: string[] }[]>(
        `/tasks/calendar?from=${from}&to=${to}`,
      ),
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiClient.post<TaskDetailDto>('/tasks', input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask(id: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => apiClient.patch<TaskDetailDto>(`/tasks/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTaskStatus(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();

  return useMutation({
    mutationFn: (status: string) => apiClient.patch<TaskDetailDto>(`/tasks/${id}/status`, { status }),
    onMutate: async (status: string) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: taskKeys.all });

      // The `['tasks']` prefix covers both list caches (arrays) and the detail
      // cache (a single object), so each entry has to be narrowed before update
      // — mapping blindly would throw on the detail entry and abort the mutation.
      queryClient.setQueriesData({ queryKey: taskKeys.all }, (old: unknown) => {
        const withStatus = <T extends { id: string; status: TaskListItemDto['status'] }>(task: T): T =>
          task.id === id ? { ...task, status: status as TaskListItemDto['status'] } : task;

        if (Array.isArray(old)) return (old as TaskListItemDto[]).map(withStatus);
        if (old && typeof old === 'object' && 'id' in old && 'status' in old) {
          return withStatus(old as TaskDetailDto);
        }
        return old;
      });

      return { previous };
    },
    onError: (_err, _status, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: invalidate,
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tasks/${id}`),
    onSuccess: (_result, id) => {
      // Drop the detail entry rather than invalidating it: a blanket
      // invalidation would refetch the task that was just deleted and 404.
      queryClient.removeQueries({ queryKey: taskKeys.detail(id) });
      invalidate();
    },
  });
}

export function useAddSubtask(taskId: string) {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (text: string) =>
      apiClient.post<TaskDetailDto>(`/tasks/${taskId}/subtasks`, { text }),
    onSuccess: invalidate,
  });
}

export function useUpdateSubtask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Pick<SubtaskDto, 'text' | 'done'>>) =>
      apiClient.patch<TaskDetailDto>(`/subtasks/${id}`, body),
    onSuccess: invalidate,
  });
}

export function useDeleteSubtask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<TaskDetailDto>(`/subtasks/${id}`),
    onSuccess: invalidate,
  });
}
