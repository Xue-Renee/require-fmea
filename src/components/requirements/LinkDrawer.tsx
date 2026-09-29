import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { LINK_TYPES } from '@/lib/constants'
import { addLink, deleteLink, linksOf } from '@/lib/store'
import type { Database, LinkType, Requirement } from '@/types'
import { Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

export function LinkDrawer({
  open,
  onOpenChange,
  req,
  db,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  req: Requirement | null
  db: Database
}) {
  const [linkType, setLinkType] = useState<LinkType>('关联')
  const [toId, setToId] = useState<string>('')

  const others = useMemo(() => {
    if (!req) return []
    return db.requirements.filter((r) => r.projectId === req.projectId && r.id !== req.id)
  }, [db.requirements, req])

  const { outgoing, incoming } = req ? linksOf(req.id, db) : { outgoing: [], incoming: [] }

  const add = () => {
    if (!req) return
    const target = Number(toId)
    if (!target) {
      toast.error('请选择目标需求')
      return
    }
    const res = addLink({ projectId: req.projectId, fromReqId: req.id, toReqId: target, linkType })
    if (!res.ok) {
      if (res.reason === 'duplicate') toast.message('该关联已存在，已忽略')
      else if (res.reason === 'self') toast.error('不允许自关联')
      else if (res.reason === 'frozen') toast.error('产品已基线，修改需求须先通过变更系统发起申请并审批通过')
      return
    }
    toast.success('已添加关联')
    setToId('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>关联需求 · {req?.reqNo}</SheetTitle>
          <div className="mt-1 line-clamp-2 text-xs text-slate-500">{req?.spec}</div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <section className="mb-4">
            <h4 className="mb-2 text-[13px] font-semibold">出向（本需求 → 类型 → 目标）</h4>
            {outgoing.length === 0 ? (
              <div className="rounded border border-dashed px-3 py-4 text-xs text-slate-400">暂无出向关联</div>
            ) : (
              <ul className="space-y-1.5">
                {outgoing.map(({ link, other }) => (
                  <li key={link.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                    <span className="text-[13px]">
                      {req?.reqNo}
                      <span className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-primary">{link.linkType}</span>
                      {other.reqNo}
                      <span className="ml-2 text-xs text-slate-400">{other.spec}</span>
                    </span>
                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => deleteLink(link.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4 className="mb-2 text-[13px] font-semibold">入向（源 → 类型 → 本需求）</h4>
            {incoming.length === 0 ? (
              <div className="rounded border border-dashed px-3 py-4 text-xs text-slate-400">暂无入向关联</div>
            ) : (
              <ul className="space-y-1.5">
                {incoming.map(({ link, other }) => (
                  <li key={link.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                    <span className="text-[13px]">
                      {other.reqNo}
                      <span className="mx-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] text-primary">{link.linkType}</span>
                      {req?.reqNo}
                      <span className="ml-2 text-xs text-slate-400">{other.spec}</span>
                    </span>
                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => deleteLink(link.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <SheetFooter>
          <div className="flex w-full items-end gap-2">
            <div className="w-28">
              <div className="mb-1 text-[12px] text-slate-500">关联类型</div>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as LinkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[12px] text-slate-500">目标需求</div>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择需求" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.reqNo} {r.spec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={add}>添加</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
