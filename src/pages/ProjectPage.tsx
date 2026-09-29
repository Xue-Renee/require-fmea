import { ChangeSystemBar } from '@/components/requirements/ChangeSystemBar'
import { TestSubmitDialog } from '@/components/requirements/TestSubmitDialog'
import { ColumnPicker } from '@/components/requirements/ColumnPicker'
import { FilterBar } from '@/components/requirements/FilterBar'
import { LinkDrawer } from '@/components/requirements/LinkDrawer'
import { RequirementFormDialog } from '@/components/requirements/RequirementFormDialog'
import { RequirementTable } from '@/components/requirements/RequirementTable'
import { StatusBadge } from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { downloadTemplate, exportProjectExcel, importProjectExcel } from '@/lib/excel'
import { REQ_STATUS } from '@/lib/constants'
import { childLevelOf, flattenReqTree, reqLevel } from '@/lib/hierarchy'
import { matchFilters, sortRequirements, useListView } from '@/lib/listView'
import { canEditRequirements, latestFreeze, setProjectStatus, useAppStore } from '@/lib/store'
import { BomPage } from '@/pages/BomPage'
import { DfmeaWorkspace } from '@/components/dfmea/DfmeaWorkspace'
import { TreeView } from '@/pages/TreeView'
import type { ReqLevel, ReqStatus, Requirement } from '@/types'
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, Plus, SlidersHorizontal, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

export function ProjectPage() {
  const { id } = useParams()
  const { db, options } = useAppStore()
  const location = useLocation()
  const navigate = useNavigate()
  const projectId = Number(id)
  const project = db.projects.find((p) => p.id === projectId)

  const listView = useListView()
  const [keyword, setKeyword] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Requirement | null>(null)
  const [composeLevel, setComposeLevel] = useState<ReqLevel>('产品需求')
  const [composeParentId, setComposeParentId] = useState<number | undefined>(undefined)
  const [linkReq, setLinkReq] = useState<Requirement | null>(null)
  const [testReq, setTestReq] = useState<Requirement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reqs = useMemo(
    () => db.requirements.filter((r) => r.projectId === projectId),
    [db.requirements, projectId],
  )
  const treeOrder = useMemo(() => flattenReqTree(reqs), [reqs])
  const treeIndex = useMemo(() => new Map(treeOrder.map((r, i) => [r.id, i])), [treeOrder])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const matched = reqs.filter((r) => {
      if (!matchFilters(r, listView.filters, db)) return false
      if (!kw) return true
      const blob = `${r.reqNo} ${r.spec} ${r.feature ?? ''} ${r.specDescription ?? ''} ${r.category}`.toLowerCase()
      return blob.includes(kw)
    })
    return sortRequirements(matched, listView.sortKey, listView.sortDir, treeIndex)
  }, [reqs, keyword, listView.filters, listView.sortKey, listView.sortDir, treeIndex, db])

  const testCounts = useMemo(() => {
    const map = new Map<number, number>()
    for (const t of db.testSubmits) {
      if (t.projectId !== projectId) continue
      map.set(t.reqId, (map.get(t.reqId) ?? 0) + 1)
    }
    return map
  }, [db.testSubmits, projectId])

  if (!project) {
    return <div className="p-8 text-slate-500">未找到该项目</div>
  }

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 px-2.5 py-1 text-[12px] ${isActive ? 'border-primary text-primary font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`

  const isTree = location.pathname.endsWith('/tree')
  const isBom = location.pathname.endsWith('/bom')
  const isDfmea = location.pathname.includes('/dfmea')
  const isList =
    !isTree && !isBom && !isDfmea && !location.pathname.endsWith('/trace') && !location.pathname.endsWith('/dashboard')
  const editGate = canEditRequirements(project.id)
  const testHistory = testReq ? db.testSubmits.filter((t) => t.reqId === testReq.id).sort((a, b) => b.id - a.id) : []

  const guardEdit = () => {
    if (!editGate.ok) {
      toast.error(editGate.reason)
      return false
    }
    return true
  }

  const openCreate = (level: ReqLevel = '产品需求', parent?: Requirement) => {
    if (!guardEdit()) return
    setEditing(null)
    setComposeLevel(level)
    setComposeParentId(parent?.id)
    setFormOpen(true)
  }

  const openEdit = (req: Requirement) => {
    setEditing(req)
    setComposeLevel(reqLevel(req))
    setComposeParentId(req.parentId)
    setFormOpen(true)
  }

  const openDecompose = (req: Requirement) => {
    const next = childLevelOf(reqLevel(req))
    if (!next) {
      toast.message('零件需求已是最底层，不能继续拆解')
      return
    }
    openCreate(next, req)
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-white px-3 py-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="shrink-0" onClick={() => navigate('/')}>
                <ArrowLeft /> 返回首页
              </Button>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <div className="truncate text-[15px] font-semibold text-slate-900">{project.name}</div>
                  <span className="shrink-0 text-[11px] text-slate-400">{project.code} / 需求条目</span>
                </div>
                {project.coreDesigners ? <div className="truncate text-[11px] text-slate-500">{project.coreDesigners}</div> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  项目状态 <StatusBadge value={project.status} />
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {REQ_STATUS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => {
                      if (s === project.status) return
                      if (s === '已基线') {
                        const fr = latestFreeze(project.id)
                        if (fr?.status !== '已通过') {
                          toast.message('请先发起并完成需求冻结评审，再将产品基线')
                          return
                        }
                      }
                      if (project.status === '已基线') {
                        if (s !== '变更中') {
                          toast.message('已基线产品须通过变更系统申请修改')
                          return
                        }
                        if (!db.changeRequests.some((c) => c.projectId === project.id && c.status === '已通过')) {
                          toast.message('已基线产品须通过变更系统发起申请，审批通过后进入变更中')
                          return
                        }
                      }
                      setProjectStatus(project.id, s as ReqStatus)
                      toast.success(`项目状态已统一设置为「${s}」`)
                    }}
                  >
                    <StatusBadge value={s} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await downloadTemplate()
                toast.success('已下载需求导入模板.xlsx')
              }}
            >
              <Download /> 下载模板
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!guardEdit()) return
                fileRef.current?.click()
              }}
            >
              <Upload /> 导入 Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await exportProjectExcel(project)
                toast.success('已导出 Excel')
              }}
            >
              <FileSpreadsheet /> 导出 Excel
            </Button>
            <Button size="sm" onClick={() => openCreate('产品需求')}>
              <Plus /> 新建需求
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) await importProjectExcel(project, file)
              }}
            />
          </div>
        </div>
        <div className="mt-1 rounded bg-slate-50/90">
          <ChangeSystemBar project={project} db={db} />
        </div>
        <div className="mt-1 flex gap-1 border-b">
          <NavLink to={`/projects/${project.id}`} end className={tabCls}>
            需求条目
          </NavLink>
          <NavLink to={`/projects/${project.id}/tree`} className={tabCls}>
            需求拆解
          </NavLink>
          <NavLink to={`/projects/${project.id}/dfmea`} className={tabCls}>
            DFMEA
          </NavLink>
          <NavLink to={`/projects/${project.id}/bom`} className={tabCls}>
            涉及零件
          </NavLink>
          <NavLink to={`/projects/${project.id}/trace`} className={tabCls}>
            追溯视图
          </NavLink>
          <NavLink to={`/projects/${project.id}/dashboard`} className={tabCls}>
            统计分析
          </NavLink>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
        {isList ? (
          <div className="flex h-full min-w-0 flex-col">
            <div className="mb-1 flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => listView.patch({ toolsOpen: !listView.toolsOpen })}
              >
                <SlidersHorizontal />
                搜索 / 筛选
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${listView.toolsOpen ? 'rotate-180' : ''}`} />
                {listView.filters.length > 0 || keyword.trim() ? (
                  <span className="rounded-full bg-sky-100 px-1.5 text-[11px] font-medium text-sky-700">
                    {(keyword.trim() ? 1 : 0) + listView.filters.length}
                  </span>
                ) : null}
              </Button>
              <div className="min-w-0 flex-1 rounded border border-sky-100 bg-sky-50/80 px-2 py-1 text-[12px] leading-snug text-slate-600">
                「需求重要度」及之前的字段（含需求重要度）由产品经理填写；之后的字段由系统工程师填写。
              </div>
              <div className="ml-auto shrink-0 text-[12px] text-slate-500">
                共 {filtered.length} 条（产品 {filtered.filter((r) => reqLevel(r) === '产品需求').length} · 模块{' '}
                {filtered.filter((r) => reqLevel(r) === '模块需求').length} · 零件{' '}
                {filtered.filter((r) => reqLevel(r) === '零件需求').length}）
              </div>
            </div>
            {listView.toolsOpen ? (
              <div className="mb-1.5 shrink-0 space-y-1.5 rounded-md border bg-white px-2.5 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Input
                    className="h-7 w-64"
                    placeholder="搜索编号 / 规格 / 特性 / 描述"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  <ColumnPicker columns={listView.columns} onChange={(columns) => listView.patch({ columns })} />
                </div>
                <FilterBar
                  filters={listView.filters}
                  sortKey={listView.sortKey}
                  sortDir={listView.sortDir}
                  reqs={reqs}
                  db={db}
                  extraOptions={{
                    category: options.categories,
                    module: options.modules.map((m) => m.value),
                    discipline: options.disciplines.map((d) => d.value),
                    acceptanceMethod: [...options.acceptanceMethods, ...options.partAcceptanceMethods],
                  }}
                  onFiltersChange={(filters) => listView.patch({ filters })}
                  onSortChange={(sortKey, sortDir) => listView.patch({ sortKey, sortDir })}
                />
              </div>
            ) : null}
            <RequirementTable
              db={db}
              rows={filtered}
              columns={listView.columns}
              colWidths={listView.colWidths}
              onColWidthsChange={(colWidths) => listView.patch({ colWidths })}
              onEdit={openEdit}
              onOpenLinks={setLinkReq}
              onDecompose={openDecompose}
              onSubmitTest={setTestReq}
              testCounts={testCounts}
            />
          </div>
        ) : isDfmea ? (
          <DfmeaWorkspace project={project} />
        ) : isBom ? (
          <BomPage project={project} db={db} />
        ) : isTree ? (
          <TreeView onEdit={openEdit} onDecompose={openDecompose} onSubmitTest={setTestReq} testCounts={testCounts} />
        ) : (
          <Outlet />
        )}
      </div>

      <RequirementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={project}
        editing={editing}
        categories={options.categories}
        modules={options.modules}
        disciplines={options.disciplines}
        acceptanceMethods={options.acceptanceMethods}
        partAcceptanceMethods={options.partAcceptanceMethods}
        allReqs={reqs}
        bomItems={db.bomItems.filter((b) => b.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder)}
        initialLevel={composeLevel}
        initialParentId={composeParentId}
      />
      <LinkDrawer open={!!linkReq} onOpenChange={(v) => !v && setLinkReq(null)} req={linkReq} db={db} />
      <TestSubmitDialog open={!!testReq} onOpenChange={(v) => !v && setTestReq(null)} req={testReq} history={testHistory} />
    </div>
  )
}
