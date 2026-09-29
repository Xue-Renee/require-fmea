import { LevelBadge } from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { analysesForReq, dfmeaAnalysisMeta } from '@/lib/dfmea'
import { childLevelOf, reqLevel, type ReqTreeNode } from '@/lib/hierarchy'
import {
  addDfmeaAnalysis,
  canEditRequirements,
  deleteDfmeaAnalysis,
  deleteRequirement,
  quickCreateRequirement,
  updateDfmeaAnalysisItem,
  updateRequirement,
} from '@/lib/store'
import { cn } from '@/lib/utils'
import type { DfmeaAnalysis, Requirement } from '@/types'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

function AnalysisItemBox({
  item,
  placeholder,
  editOk,
}: {
  item: DfmeaAnalysis
  placeholder: string
  editOk: boolean
}) {
  const [editing, setEditing] = useState(!item.text.trim())
  const [draft, setDraft] = useState(item.text)

  const save = () => {
    const next = draft.trim()
    if (next !== item.text) updateDfmeaAnalysisItem(item.id, next)
    setEditing(false)
  }

  return (
    <div className="mm-box mm-box-analysis" onClick={(e) => e.stopPropagation()}>
      {editing && editOk ? (
        <textarea
          className="w-full rounded border px-1.5 py-1 text-[13px]"
          value={draft}
          autoFocus
          rows={2}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setDraft(item.text)
              setEditing(false)
            }
          }}
        />
      ) : (
        <div className="flex items-start gap-1">
          <button
            type="button"
            className="min-w-0 flex-1 text-left text-[13px] font-medium leading-snug text-slate-800"
            onClick={() => {
              if (!editOk) return
              setDraft(item.text)
              setEditing(true)
            }}
          >
            {item.text || <span className="font-normal text-slate-400">{placeholder}</span>}
          </button>
          {editOk ? (
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600"
              title="删除此条分析"
              onClick={() => deleteDfmeaAnalysis(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function AnalysisStack({
  req,
  analyses,
  projectId,
  editOk,
}: {
  req: Requirement
  analyses: DfmeaAnalysis[]
  projectId: number
  editOk: boolean
}) {
  const meta = dfmeaAnalysisMeta(reqLevel(req))
  const items = analysesForReq(req, analyses)
  const placeholder = `填写${meta.verb}`

  return (
    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 px-0.5 text-[10px] text-emerald-700">
        <span className="rounded bg-emerald-50 px-1 font-medium">{meta.label}</span>
        <span className="text-emerald-600/80">针对{reqLevel(req)}分析，可多条</span>
      </div>
      {items.length === 0 ? (
        <div className="mm-box mm-box-analysis">
          <button
            type="button"
            className="w-full text-left text-[13px] font-normal text-slate-400"
            onClick={() => {
              if (!editOk) return
              addDfmeaAnalysis(projectId, req.id)
            }}
          >
            {placeholder}
          </button>
        </div>
      ) : (
        items.map((item) => <AnalysisItemBox key={item.id} item={item} placeholder={placeholder} editOk={editOk} />)
      )}
    </div>
  )
}

function NodeBox({
  req,
  selected,
  onSelect,
  onAddChild,
  onAddAnalysis,
  onDelete,
  editOk,
}: {
  req: Requirement
  selected: boolean
  onSelect: () => void
  onAddChild?: () => void
  onAddAnalysis: () => void
  onDelete: () => void
  editOk: boolean
}) {
  const [editing, setEditing] = useState<'spec' | 'desc' | null>(null)
  const [draft, setDraft] = useState(req.spec)
  const [descDraft, setDescDraft] = useState(req.specDescription ?? '')
  const level = reqLevel(req)
  const child = childLevelOf(level)
  const meta = dfmeaAnalysisMeta(level)

  const saveSpec = () => {
    const next = draft.trim()
    if (!next) {
      toast.error('节点内容不能为空')
      return
    }
    if (next !== req.spec) {
      try {
        updateRequirement(req.id, { spec: next })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '保存失败')
        setDraft(req.spec)
        setEditing(null)
        return
      }
    }
    setEditing(null)
  }

  const saveDesc = () => {
    const next = descDraft.trim()
    if (next !== (req.specDescription ?? '')) {
      try {
        updateRequirement(req.id, { specDescription: next || undefined })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '保存失败')
        setDescDraft(req.specDescription ?? '')
        setEditing(null)
        return
      }
    }
    setEditing(null)
  }

  return (
    <div
      className={cn(
        'mm-box',
        level === '产品需求' && 'mm-box-product',
        level === '模块需求' && 'mm-box-module',
        level === '零件需求' && 'mm-box-part',
        selected && 'mm-box-selected',
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span>{req.reqNo}</span>
            <LevelBadge value={level} />
          </div>
          {editing === 'spec' ? (
            <textarea
              className="mt-1 w-56 rounded border px-1.5 py-1 text-[13px]"
              value={draft}
              autoFocus
              rows={2}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveSpec}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveSpec()
                }
                if (e.key === 'Escape') {
                  setDraft(req.spec)
                  setEditing(null)
                }
              }}
            />
          ) : (
            <div className="mt-0.5 text-[13px] font-medium leading-snug text-slate-800">{req.spec}</div>
          )}
          {editing === 'desc' ? (
            <textarea
              className="mt-1 w-56 rounded border px-1.5 py-1 text-[11px] text-emerald-800"
              value={descDraft}
              autoFocus
              rows={2}
              placeholder="测试条件 / 目标值 / 底线值"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveDesc()
                }
                if (e.key === 'Escape') {
                  setDescDraft(req.specDescription ?? '')
                  setEditing(null)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="mt-1 w-full text-left text-[11px] leading-snug text-emerald-700 hover:bg-white/60"
              onClick={(e) => {
                e.stopPropagation()
                if (!editOk) return
                setDescDraft(req.specDescription ?? '')
                setEditing('desc')
              }}
            >
              {req.specDescription || (editOk ? <span className="text-emerald-700/50">点击填写规格描述</span> : null)}
            </button>
          )}
          <div className="mt-1 text-[10px] text-slate-400">需做{meta.verb}</div>
        </div>
        {editOk ? (
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-primary"
              title="编辑需求"
              onClick={(e) => {
                e.stopPropagation()
                setDraft(req.spec)
                setEditing('spec')
              }}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-primary"
                  title="新增"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                {child && onAddChild ? (
                  <DropdownMenuItem onSelect={() => onAddChild()}>增加下级需求（{child}）</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => onAddAnalysis()}>增加{meta.label}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600"
              title="删除"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Branch({
  node,
  selectedId,
  analyses,
  projectId,
  onSelect,
  onAdd,
  onDelete,
  editOk,
}: {
  node: ReqTreeNode
  selectedId: number | null
  analyses: DfmeaAnalysis[]
  projectId: number
  onSelect: (req: Requirement) => void
  onAdd: (parent: Requirement) => void
  onDelete: (req: Requirement) => void
  editOk: boolean
}) {
  return (
    <div className="mm-branch">
      <NodeBox
        req={node.req}
        selected={selectedId === node.req.id}
        onSelect={() => onSelect(node.req)}
        onAddChild={childLevelOf(reqLevel(node.req)) ? () => onAdd(node.req) : undefined}
        onAddAnalysis={() => addDfmeaAnalysis(projectId, node.req.id)}
        onDelete={() => onDelete(node.req)}
        editOk={editOk}
      />
      <div className="mm-kids">
        <div className="mm-kid">
          <AnalysisStack req={node.req} analyses={analyses} projectId={projectId} editOk={editOk} />
        </div>
        {node.children.map((child) => (
          <div key={child.req.id} className="mm-kid">
            <Branch
              node={child}
              selectedId={selectedId}
              analyses={analyses}
              projectId={projectId}
              onSelect={onSelect}
              onAdd={onAdd}
              onDelete={onDelete}
              editOk={editOk}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DfmeaMindMap({
  projectId,
  tree,
  analyses,
}: {
  projectId: number
  tree: ReqTreeNode[]
  analyses: DfmeaAnalysis[]
}) {
  const [selectedId, setSelectedId] = useState<number | null>(tree[0]?.req.id ?? null)
  const editGate = canEditRequirements(projectId)
  const editOk = editGate.ok

  const addChild = (parent: Requirement) => {
    const next = childLevelOf(reqLevel(parent))
    if (!next) return
    try {
      const created = quickCreateRequirement(projectId, `新${next}`, next, parent.id)
      setSelectedId(created.id)
      toast.success(`已在结构树新增 ${created.reqNo}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '无法新增')
    }
  }

  const addProduct = () => {
    try {
      const created = quickCreateRequirement(projectId, '新产品需求', '产品需求')
      setSelectedId(created.id)
      toast.success(`已新增 ${created.reqNo}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '无法新增')
    }
  }

  const remove = (req: Requirement) => {
    if (!window.confirm(`删除「${req.reqNo}」及其子节点？需求与 DFMEA 行将同步删除。`)) return
    try {
      deleteRequirement(req.id)
      toast.success(`已删除 ${req.reqNo}`)
      setSelectedId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center gap-2 text-[12px] text-slate-500">
        <span>
          需求卡片上的「+」可选择增加下级需求，或增加本层失效影响 / 失效模式 / 失效原因。绿色规格描述可直接点击编辑。
        </span>
        {editOk ? (
          <Button size="sm" className="ml-auto shrink-0" onClick={addProduct}>
            <Plus /> 新增产品节点
          </Button>
        ) : (
          <span className="ml-auto shrink-0 text-amber-700">已基线，结构树只读；可在表格中继续做 SOD 评估。</span>
        )}
      </div>
      <div className="mm-canvas min-h-0 flex-1 overflow-auto rounded-md border bg-[#f7fbff] p-6" onClick={() => setSelectedId(null)}>
        {tree.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            暂无需求结构。请在此新增产品节点，或先在需求模块拆解后再进入 DFMEA。
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {tree.map((n) => (
              <Branch
                key={n.req.id}
                node={n}
                selectedId={selectedId}
                analyses={analyses}
                projectId={projectId}
                onSelect={(r) => setSelectedId(r.id)}
                onAdd={addChild}
                onDelete={remove}
                editOk={editOk}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
