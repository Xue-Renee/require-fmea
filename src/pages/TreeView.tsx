import { LevelBadge } from '@/components/StatusBadges'
import { buildReqTree, childrenOf, parentOf, reqLevel, type ReqTreeNode } from '@/lib/hierarchy'
import { formatBomLabel, linksOf, useAppStore } from '@/lib/store'
import type { BomItem, Requirement } from '@/types'
import { ChevronDown, ChevronRight, FlaskConical, GitFork, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

export function TreeView({
  onEdit,
  onDecompose,
  onSubmitTest,
  testCounts,
}: {
  onEdit?: (req: Requirement) => void
  onDecompose?: (req: Requirement) => void
  onSubmitTest?: (req: Requirement) => void
  testCounts?: Map<number, number>
}) {
  const { id } = useParams()
  const { db } = useAppStore()
  const projectId = Number(id)
  const reqs = useMemo(
    () => db.requirements.filter((r) => r.projectId === projectId),
    [db.requirements, projectId],
  )
  const tree = useMemo(() => buildReqTree(reqs), [reqs])
  const [selectedId, setSelectedId] = useState<number | null>(tree[0]?.req.id ?? null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const selected = reqs.find((r) => r.id === selectedId) ?? null
  const bomById = useMemo(() => {
    const map = new Map<number, BomItem>()
    for (const b of db.bomItems ?? []) {
      if (b.projectId === projectId) map.set(b.id, b)
    }
    return map
  }, [db.bomItems, projectId])
  const selectedBom = selected?.bomItemId ? bomById.get(selected.bomItemId) : undefined
  const parent = selected ? parentOf(selected, reqs) : undefined
  const kids = selected ? childrenOf(selected.id, reqs) : []
  const { outgoing, incoming } = selected ? linksOf(selected.id, db) : { outgoing: [], incoming: [] }
  const hierarchyIds = new Set<number>([...(parent ? [parent.id] : []), ...kids.map((k) => k.id)])
  const otherIn = incoming.filter(({ other }) => !hierarchyIds.has(other.id))
  const otherOut = outgoing.filter(({ other }) => !hierarchyIds.has(other.id))

  const toggle = (nid: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(nid)) next.delete(nid)
      else next.add(nid)
      return next
    })
  }

  const counts = {
    产品需求: reqs.filter((r) => reqLevel(r) === '产品需求').length,
    模块需求: reqs.filter((r) => reqLevel(r) === '模块需求').length,
    零件需求: reqs.filter((r) => reqLevel(r) === '零件需求').length,
  }

  return (
    <div className="flex h-full min-w-0 gap-4 overflow-hidden">
      <div className="min-w-0 flex-[1.2] overflow-auto rounded-md border bg-white">
        <div className="sticky top-0 z-10 border-b bg-white px-3 py-2">
          <div className="text-[13px] font-semibold">需求拆解</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            产品 {counts.产品需求} · 模块 {counts.模块需求} · 零件 {counts.零件需求}
          </div>
        </div>
        {tree.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">暂无需求，请先新建产品需求再向下拆解</div>
        ) : (
          <div className="py-1">
            {tree.map((node) => (
              <TreeNodeView
                key={node.req.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                collapsed={collapsed}
                onToggle={toggle}
                onSelect={setSelectedId}
                bomById={bomById}
              />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-auto">
        {!selected ? (
          <div className="rounded-md border border-dashed bg-white p-8 text-center text-slate-400">
            在左侧需求拆解中选择一条需求，查看父子追溯
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <LevelBadge value={reqLevel(selected)} />
                <div className="text-sm font-semibold">{selected.reqNo}</div>
              </div>
              <div className="mt-1 text-[13px] text-slate-600">{selected.spec}</div>
              {selectedBom ? (
                <div className="mt-1 text-[12px] text-slate-500">关联BOM：{formatBomLabel(selectedBom)}</div>
              ) : reqLevel(selected) === '零件需求' ? (
                <div className="mt-1 text-[12px] text-amber-600">尚未关联涉及零件</div>
              ) : null}
              <div className="mt-3 flex gap-2">
                {onEdit ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50"
                    onClick={() => onEdit(selected)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> 编辑
                  </button>
                ) : null}
                {reqLevel(selected) !== '零件需求' && onSubmitTest ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-50"
                    onClick={() => onSubmitTest(selected)}
                  >
                    <FlaskConical className="h-3.5 w-3.5" /> 提测
                    {testCounts?.get(selected.id) ? `(${testCounts.get(selected.id)})` : ''}
                  </button>
                ) : null}
                {reqLevel(selected) !== '零件需求' && onDecompose ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-primary/30 bg-sky-50 px-2 py-1 text-[12px] text-primary hover:bg-sky-100"
                    onClick={() => onDecompose(selected)}
                  >
                    <GitFork className="h-3.5 w-3.5" /> 拆解为
                    {reqLevel(selected) === '产品需求' ? '模块需求' : '零件需求'}
                  </button>
                ) : null}
              </div>
            </div>
            <RelationBlock
              title="父需求"
              empty="无父需求（产品需求为层级一）"
              items={parent ? [{ req: parent, tag: reqLevel(parent) }] : []}
              onSelect={(id) => setSelectedId(id)}
            />
            <RelationBlock
              title={`子需求（${kids.length}）`}
              empty="暂无子需求，可点击「拆解」向下分解"
              items={kids.map((req) => ({ req, tag: reqLevel(req) }))}
              onSelect={(id) => setSelectedId(id)}
            />
            <RelationBlock
              title={`其他关联 · 上游被引用（${otherIn.length}）`}
              empty="暂无上游引用"
              items={otherIn.map(({ link, other }) => ({ req: other, tag: link.linkType }))}
              onSelect={(id) => setSelectedId(id)}
            />
            <RelationBlock
              title={`其他关联 · 下游引用（${otherOut.length}）`}
              empty="暂无下游引用"
              items={otherOut.map(({ link, other }) => ({ req: other, tag: link.linkType }))}
              onSelect={(id) => setSelectedId(id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TreeNodeView({
  node,
  depth,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  bomById,
}: {
  node: ReqTreeNode
  depth: number
  selectedId: number | null
  collapsed: Set<number>
  onToggle: (id: number) => void
  onSelect: (id: number) => void
  bomById: Map<number, BomItem>
}) {
  const hasKids = node.children.length > 0
  const open = !collapsed.has(node.req.id)
  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-start gap-1 py-1.5 pr-3 text-left hover:bg-slate-50 ${selectedId === node.req.id ? 'bg-sky-50' : ''}`}
        style={{ paddingLeft: 8 + depth * 18 }}
        onClick={() => onSelect(node.req.id)}
      >
        <span
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400"
          onClick={(e) => {
            if (!hasKids) return
            e.stopPropagation()
            onToggle(node.req.id)
          }}
        >
          {hasKids ? open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" /> : <span className="h-1 w-1 rounded-full bg-slate-300" />}
        </span>
        <span className="min-w-0">
          <span className="mr-1.5 font-medium text-slate-800">{node.req.reqNo}</span>
          <LevelBadge value={reqLevel(node.req)} />
          {node.req.bomItemId && bomById.get(node.req.bomItemId) ? (
            <span className="ml-1 text-[11px] text-slate-400">
              {(() => {
                const bom = bomById.get(node.req.bomItemId)
                return bom?.moduleGroup ? `${bom.moduleGroup} / ${bom.partNo}` : bom?.partNo
              })()}
            </span>
          ) : null}
          <span className="mt-0.5 block truncate text-[12px] text-slate-500">{node.req.spec}</span>
        </span>
      </button>
      {hasKids && open
        ? node.children.map((child) => (
            <TreeNodeView
              key={child.req.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              bomById={bomById}
            />
          ))
        : null}
    </div>
  )
}

function RelationBlock({
  title,
  empty,
  items,
  onSelect,
}: {
  title: string
  empty: string
  items: { req: Requirement; tag: string }[]
  onSelect: (id: number) => void
}) {
  return (
    <section className="rounded-md border bg-white p-4">
      <h3 className="mb-2 text-[13px] font-semibold">{title}</h3>
      {items.length === 0 ? (
        <div className="rounded border border-dashed px-3 py-5 text-center text-xs text-slate-400">{empty}</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ req, tag }) => (
            <li key={req.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded border px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => onSelect(req.id)}
              >
                <span className="mt-0.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-primary">{tag}</span>
                <span>
                  <span className="block text-[13px] font-medium">{req.reqNo}</span>
                  <span className="block text-xs text-slate-500">{req.spec}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
