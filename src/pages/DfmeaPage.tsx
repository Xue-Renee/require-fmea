import { Navigate, useLocation, useParams } from 'react-router-dom'

export function DfmeaPage() {
  const { id } = useParams()
  const location = useLocation()
  const table = location.pathname.endsWith('/table')
  return <Navigate to={table ? `/projects/${id}/dfmea/table` : `/projects/${id}/dfmea`} replace />
}
