import { DfmeaMindMap } from '@/components/dfmea/DfmeaMindMap'
import { DfmeaTable } from '@/components/dfmea/DfmeaTable'
import { Button } from '@/components/ui/button'
import { downloadDfmeaTemplate, exportProjectDfmea, importProjectDfmea } from '@/lib/excel'
import { buildReqTree } from '@/lib/hierarchy'
import { canEditRequirements, syncDfmeaFromRequirements, useAppStore } from '@/lib/store'
import type { Project } from '@/types'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

export function DfmeaWorkspace({ project }: { project: Project }) {
  const { db } = useAppStore()
  const location = useLocation()
  const fileRef = useRef<HTMLInputElement>(null)
  const base = `/projects/${project.id}/dfmea`
  const isTable = location.pathname.endsWith('/dfmea/table') || location.pathname.endsWith(`${base}/table`)
  const editGate = canEditRequirements(project.id)

  useEffect(() => {
    syncDfmeaFromRequirements(project.id)
  }, [project.id, db.requirements])

  const reqs = useMemo(
    () => db.requirements.filter((r) => r.projectId === project.id),
    [db.requirements, project.id],
  )
  const tree = useMemo(() => buildReqTree(reqs), [reqs])
  const rows = useMemo(() => {
    const byId = new Map(reqs.map((r) => [r.id, r]))
    return db.dfmeaRecords
      .filter((r) => r.projectId === project.id)
      .map((rec) => ({
        record: rec,
        product: rec.productReqId ? byId.get(rec.productReqId) : undefined,
        module: rec.moduleReqId ? byId.get(rec.moduleReqId) : undefined,
        part: rec.partReqId ? byId.get(rec.partReqId) : undefined,
      }))
  }, [reqs, db.dfmeaRecords, project.id])

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2.5 py-1 text-[12px] ${isActive ? 'bg-sky-50 font-semibold text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-1.5">
        <NavLink to={base} end className={tabCls}>
          结构树
        </NavLink>
        <NavLink to={`${base}/table`} className={tabCls}>
          DFMEA 表格
        </NavLink>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await downloadDfmeaTemplate()
              toast.success('已下载 DFMEA 导入模板.xlsx')
            }}
          >
            <Download /> 下载模板
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!editGate.ok) {
                toast.error(editGate.reason)
                return
              }
              fileRef.current?.click()
            }}
          >
            <Upload /> 导入 Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await exportProjectDfmea(project)
              toast.success('已导出 DFMEA Excel')
            }}
          >
            <FileSpreadsheet /> 导出 Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) await importProjectDfmea(project, file)
            }}
          />
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {isTable ? (
          <DfmeaTable db={db} project={project} rows={rows} />
        ) : (
          <DfmeaMindMap
            projectId={project.id}
            tree={tree}
            analyses={db.dfmeaAnalyses.filter((a) => a.projectId === project.id)}
          />
        )}
      </div>
    </div>
  )
}
