import { LevelBadge } from '@/components/StatusBadges'
import { flattenReqTree, parentOf, reqLevel } from '@/lib/hierarchy'
import { formatBomLabel, linksOf, useAppStore } from '@/lib/store'
import type { Requirement } from '@/types'
import { ArrowRight, GitBranch, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

function levelTone(req: Requirement) {
  const level = reqLevel(req)
  if (level === '产品需求') return { ring: 'border-sky-400 bg-sky-50', bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-800' }
  if (level === '模块需求') return { ring: 'border-teal-400 bg-teal-50', bar: 'bg-teal-500', chip: 'bg-teal-100 text-teal-800' }
  return { ring: 'border-amber-400 bg-amber-50', bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-900' }
}

function indentOf(req: Requirement) {
  const level = reqLevel(req)
  if (level === '模块需求') return 16
  if (level === '零件需求') return 32
  return 0
}

export function TraceView() {
  const { id } = useParams()
  const { db } = useAppStore()
  const projectId = Number(id)
  const reqs = useMemo(
    () => flattenReqTree(db.requirements.filter((r) => r.projectId === projectId)),
    [db.requirements, projectId],
  )
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(reqs[0]?.id ?? null)
  const selected = reqs.find((r) => r.id === selectedId) ?? null
  const { outgoing, incoming } = selected ? linksOf(selected.id, db) : { outgoing: [], incoming: [] }
  const parent = selected ? parentOf(selected, reqs) : undefined
  const kids = selected ? reqs.filter((r) => r.parentId === selected.id) : []
  const hierarchyIds = new Set<number>([...(parent ? [parent.id] : []), ...kids.map((k) => k.id)])
  const otherIn = incoming.filter(({ other }) => !hierarchyIds.has(other.id))
  const otherOut = outgoing.filter(({ other }) => !hierarchyIds.has(other.id))
  const bom = selected?.bomItemId ? db.bomItems.find((b) => b.id === selected.bomItemId) : undefined

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return reqs
    return reqs.filter((r) => `${r.reqNo} ${r.spec} ${r.feature ?? ''}`.toLowerCase().includes(kw))
  }, [reqs, keyword])

  return (
    <div className="flex h-full min-w-0 gap-3 overflow-hidden">
      <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b bg-slate-800 px-3 py-2 text-[13px] font-semibold text-white">需求结构</div>
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1.5 h-3.5 w-3.5 text-slate-400" />
            <input
              className="h-7 w-full rounded border border-slate-300 bg-white pl-7 pr-2 text-[12px] outline-none focus:border-sky-500"
              placeholder="搜索编号 / 规格"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-auto">
          {filtered.map((r) => {
            const active = selectedId === r.id
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full border-l-4 px-2 py-2 text-left ${
                    active ? 'border-sky-500 bg-sky-50' : 'border-transparent hover:bg-slate-50'
                  }`}
                  style={{ paddingLeft: 10 + indentOf(r) }}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-900">{r.reqNo}</span>
                    <LevelBadge value={reqLevel(r)} />
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-600">{r.spec}</div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="min-w-0 flex-1 overflow-auto rounded-lg border border-slate-300 bg-slate-100 p-3">
        {!selected ? (
          <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-400 bg-white text-[14px] text-slate-500">
            请在左侧选择一条需求，查看上下游追溯链
          </div>
        ) : (
          <div className="space-y-3">
            <CurrentCard req={selected} bomLabel={bom ? formatBomLabel(bom) : undefined} />
            <section className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <GitBranch className="h-4 w-4 text-sky-600" />
                拆解链路
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {parent ? (
                  <>
                    <NodeCard req={parent} onPick={setSelectedId} caption="父需求" />
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-500" />
                  </>
                ) : (
                  <span className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-[12px] text-slate-400">
                    无父需求（顶层）
                  </span>
                )}
                <NodeCard req={selected} current />
                {kids.length > 0 ? (
                  <>
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-500" />
                    <div className="flex min-w-0 flex-col gap-2">
                      {kids.map((k) => (
                        <NodeCard key={k.id} req={k} onPick={setSelectedId} caption="子需求" />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-5 w-5 shrink-0 text-slate-300" />
                    <span className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-[12px] text-slate-400">
                      无子需求
                    </span>
                  </>
                )}
              </div>
            </section>
            <div className="grid gap-3 lg:grid-cols-2">
              <TraceLane
                title={`上游 · 被谁引用（${otherIn.length}）`}
                tone="rose"
                items={otherIn}
                empty="没有其他需求引用当前条目"
                onPick={setSelectedId}
              />
              <TraceLane
                title={`下游 · 当前引用（${otherOut.length}）`}
                tone="indigo"
                items={otherOut}
                empty="当前条目没有引用其他需求"
                onPick={setSelectedId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CurrentCard({ req, bomLabel }: { req: Requirement; bomLabel?: string }) {
  const tone = levelTone(req)
  return (
    <div className={`overflow-hidden rounded-lg border-2 shadow-sm ${tone.ring}`}>
      <div className={`h-1.5 ${tone.bar}`} />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge value={reqLevel(req)} />
          <div className="text-[18px] font-bold text-slate-900">{req.reqNo}</div>
          {req.feature ? <span className={`rounded px-1.5 py-0.5 text-[12px] ${tone.chip}`}>{req.feature}</span> : null}
        </div>
        <div className="mt-2 text-[15px] font-medium leading-relaxed text-slate-800">{req.spec}</div>
        {req.specDescription ? <div className="mt-1 text-[13px] leading-relaxed text-slate-600">{req.specDescription}</div> : null}
        {bomLabel ? <div className="mt-2 text-[12px] font-medium text-teal-800">BOM：{bomLabel}</div> : null}
      </div>
    </div>
  )
}

function NodeCard({
  req,
  current,
  caption,
  onPick,
}: {
  req: Requirement
  current?: boolean
  caption?: string
  onPick?: (id: number) => void
}) {
  const tone = levelTone(req)
  const inner = (
    <>
      {caption ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{caption}</div> : null}
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-bold text-slate-900">{req.reqNo}</span>
        <LevelBadge value={reqLevel(req)} />
      </div>
      <div className="mt-1 max-w-[280px] text-[12px] leading-snug text-slate-700">{req.spec}</div>
    </>
  )
  const cls = `min-w-[220px] rounded-lg border-2 px-3 py-2 text-left shadow-sm ${tone.ring} ${current ? 'ring-2 ring-sky-500 ring-offset-1' : ''}`
  if (!onPick) return <div className={cls}>{inner}</div>
  return (
    <button type="button" className={`${cls} hover:brightness-95`} onClick={() => onPick(req.id)}>
      {inner}
    </button>
  )
}

function TraceLane({
  title,
  tone,
  items,
  empty,
  onPick,
}: {
  title: string
  tone: 'rose' | 'indigo'
  items: { link: { linkType: string }; other: Requirement }[]
  empty: string
  onPick: (id: number) => void
}) {
  const head = tone === 'rose' ? 'bg-rose-700 text-white' : 'bg-indigo-700 text-white'
  const chip = tone === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
  return (
    <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className={`px-3 py-2 text-[13px] font-semibold ${head}`}>{title}</div>
      <div className="p-3">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-[13px] text-slate-500">
            {empty}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map(({ link, other }) => (
              <li key={`${link.linkType}-${other.id}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-slate-400 hover:bg-white"
                  onClick={() => onPick(other.id)}
                >
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${chip}`}>{link.linkType}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-slate-900">{other.reqNo}</span>
                      <LevelBadge value={reqLevel(other)} />
                    </div>
                    <div className="mt-0.5 text-[12px] leading-snug text-slate-600">{other.spec}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
