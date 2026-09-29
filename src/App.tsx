import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardView } from '@/pages/DashboardView'
import { DfmeaHomePage } from '@/pages/DfmeaHomePage'
import { DfmeaPage } from '@/pages/DfmeaPage'
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TraceView } from '@/pages/TraceView'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

export default function App() {
  return (
    <HashRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:id" element={<ProjectPage />}>
            <Route path="tree" element={<></>} />
            <Route path="dfmea" element={<></>} />
            <Route path="dfmea/table" element={<></>} />
            <Route path="bom" element={<></>} />
            <Route path="trace" element={<TraceView />} />
            <Route path="dashboard" element={<DashboardView />} />
          </Route>
          <Route path="/dfmea" element={<DfmeaHomePage />} />
          <Route path="/dfmea/:id" element={<DfmeaPage />} />
          <Route path="/dfmea/:id/:view" element={<DfmeaPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
