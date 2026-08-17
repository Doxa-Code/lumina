import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/react-router/v6';
import { trpc, createTRPCClient } from './lib/trpc';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';
import { HomePage } from './pages/dashboard/Home';
import { TracesPage } from './pages/traces/TracesPage';
import { TraceDetailPage } from './pages/traces/TraceDetailPage';
import { LogsPage } from './pages/logs/LogsPage';
import { ServicesPage } from './pages/services/ServicesPage';
import { ServiceMapPage } from './pages/services/ServiceMapPage';
import { ErrorsPage } from './pages/errors/ErrorsPage';
import { QueryBuilderPage } from './pages/queries/QueryBuilderPage';
import { MetricsPage } from './pages/metrics/MetricsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ApiKeysPage } from './pages/settings/ApiKeysPage';
import { TeamMembersPage } from './pages/settings/TeamMembersPage';
import { DataRetentionPage } from './pages/settings/DataRetentionPage';
import { SecurityPage } from './pages/settings/SecurityPage';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { AlertDetailPage } from './pages/alerts/AlertDetailPage';
import { ChannelsPage } from './pages/alerts/ChannelsPage';
import { DashboardsPage } from './pages/dashboards/DashboardsPage';
import { DashboardViewPage } from './pages/dashboards/DashboardViewPage';
import { DashboardEditPage } from './pages/dashboards/DashboardEditPage';
import { InstrumentationExamplesPage } from './pages/docs/InstrumentationExamplesPage';
import { useAuthStore } from './stores/authStore';
import { useProjectStore } from './stores/projectStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

// Getter function for current project ID - read from store state directly
const getProjectId = () => useProjectStore.getState().currentProject?.id ?? null;
const trpcClient = createTRPCClient(getProjectId);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NuqsAdapter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="/traces" element={<TracesPage />} />
              <Route path="/traces/:traceId" element={<TraceDetailPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/map" element={<ServiceMapPage />} />
              <Route path="/errors" element={<ErrorsPage />} />
              <Route path="/queries" element={<QueryBuilderPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/alerts/channels" element={<ChannelsPage />} />
              <Route path="/alerts/:alertId" element={<AlertDetailPage />} />
              <Route path="/dashboards" element={<DashboardsPage />} />
              <Route path="/dashboards/:id" element={<DashboardViewPage />} />
              <Route path="/dashboards/:id/edit" element={<DashboardEditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/api-keys" element={<ApiKeysPage />} />
              <Route path="/settings/team" element={<TeamMembersPage />} />
              <Route path="/settings/retention" element={<DataRetentionPage />} />
              <Route path="/settings/security" element={<SecurityPage />} />
              <Route path="/docs/instrumentation" element={<InstrumentationExamplesPage />} />
            </Route>
          </Routes>
          </NuqsAdapter>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
