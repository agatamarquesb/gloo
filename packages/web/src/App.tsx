import { RouterProvider } from '@heroui/react';
import { Route, Routes, useHref, useNavigate } from 'react-router';

import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { TasksPage } from '@/pages/TasksPage';

export function App() {
  const navigate = useNavigate();

  return (
    <RouterProvider navigate={navigate} useHref={useHref}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TasksPage />} />
        </Route>
      </Routes>
    </RouterProvider>
  );
}
