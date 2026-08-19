import { RouterProvider } from '@heroui/react';
import { Route, Routes, useHref, useNavigate } from 'react-router';

import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { CalendarPage } from '@/pages/CalendarPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProjectPage } from '@/pages/ProjectPage';
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
          <Route path="/calendar" element={<CalendarPage />} />
          {/* Placeholders, so the Tasks page's project folders and the chevron
              beside their heading land somewhere rather than on a blank shell —
              see ProjectPage. The index and a single project share it until
              either is actually built. */}
          <Route path="/projects" element={<ProjectPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
        </Route>
      </Routes>
    </RouterProvider>
  );
}
