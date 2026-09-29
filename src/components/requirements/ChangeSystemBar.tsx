import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FREEZE_REVIEW_ROLES } from '@/lib/constants'
import {
  closeChangeRequest,
  decideChangeRequest,
  decideFreezeReview,
  latestFreeze,
  startChangeRequest,
  startFreezeReview,
} from '@/lib/store'
import { currentActor, formatDateTime } from '@/lib/utils'
import type { ChangeRequest, Database, FreezeReview, Project } from '@/types'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

export function ChangeSystemBar({ project, db }: { project: Project; db: Database }) {
  const freeze = latestFreeze(project.id, db)
  const changes = useMemo(
    () => db.changeRequests.filter((c) => c.projectId === project.id).sort((a, b) => b.id - a.id),
    [db.changeRequests, project.id],
  )
  const openChange = changes.find((c) => c.status === '已通过' || c.status === '审批中')
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const freezeLabel = freeze?.status ?? '未发起'
  const changeCount = changes.length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-3 py-1 text-[12px]">
        <span className="font-medium text-slate-700">产品基线 / 变更</span>
        <span className="text-slate-500">冻结评审：{freezeLabel}</span>
        <span className="text-slate-500">变更次数：{changeCount}</span>
        {project.status === '已基线' ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">需求已冻结</span>
        ) : project.status === '变更中' ? (
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">变更窗口开启</span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button variant="secondary" className="h-6 px-2 text-[12px]" onClick={() => setFreezeOpen(true)}>
            发起冻结评审
          </Button>
          {freeze?.status === '评审中' ? (
            <Button variant="secondary" className="h-6 px-2 text-[12px]" onClick={() => setReviewOpen(true)}>
              填写评审结论
            </Button>
          ) : null}
          <Button variant="secondary" className="h-6 px-2 text-[12px]" onClick={() => setChangeOpen(true)}>
            发起变更
          </Button>
          {openChange?.status === '审批中' ? (
            <Button
              variant="secondary"
              className="h-6 px-2 text-[12px]"
              onClick={() => {
                decideChangeRequest(openChange.id, '已通过')
                toast.success('变更已通过，产品进入「变更中」，可以修改需求')
              }}
            >
              通过变更
            </Button>
          ) : null}
          {openChange?.status === '已通过' ? (
            <Button
              variant="secondary"
              className="h-6 px-2 text-[12px]"
              onClick={() => {
                closeChangeRequest(openChange.id)
                toast.success('变更已关闭，产品重新基线')
              }}
            >
              完成变更
            </Button>
          ) : null}
          <Button variant="secondary" className="h-6 px-2 text-[12px]" onClick={() => setHistoryOpen(true)}>
            变更历史
          </Button>
        </div>
      </div>
      <FreezeDialog open={freezeOpen} onOpenChange={setFreezeOpen} project={project} />
      <FreezeDecideDialog open={reviewOpen} onOpenChange={setReviewOpen} review={freeze} />
      <ChangeDialog open={changeOpen} onOpenChange={setChangeOpen} project={project} freeze={freeze} hasOpenChange={!!openChange} />
      <ChangeHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} changes={changes} />
    </>
  )
}

function FreezeDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
}) {
  const [initiator, setInitiator] = useState(currentActor())
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(FREEZE_REVIEW_ROLES.map((r) => [r, ''])))

  const submit = () => {
    const reviewers = FREEZE_REVIEW_ROLES.map((role) => ({ role, name: names[role]?.trim() || '' }))
    const missing = reviewers.filter((r) => !r.name)
    if (missing.length) {
      toast.error(`评审人须至少包含：${FREEZE_REVIEW_ROLES.join('、')}。缺少 ${missing.map((m) => m.role).join('、')}`)
      return
    }
    if (!initiator.trim()) {
      toast.error('请填写发起人')
      return
    }
    startFreezeReview(project.id, { initiator, reviewers })
    toast.success('已发起需求冻结评审，请评审人给出结论')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>需求冻结评审 · {project.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[12.5px] text-slate-600">
            产品到达已基线前须完成冻结评审。评审人由发起方定义，至少包含 SE、项目经理、新产品质量、软件代表、硬件项目经理、测试代表、产品经理。
          </p>
          <div className="grid gap-1">
            <Label>发起人</Label>
            <Input value={initiator} onChange={(e) => setInitiator(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FREEZE_REVIEW_ROLES.map((role) => (
              <div key={role} className="grid gap-1">
                <Label>
                  {role} <span className="text-red-500">*</span>
                </Label>
                <Input value={names[role] ?? ''} onChange={(e) => setNames((n) => ({ ...n, [role]: e.target.value }))} placeholder="姓名" />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit}>发起评审</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FreezeDecideDialog({
  open,
  onOpenChange,
  review,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  review?: FreezeReview
}) {
  if (!review) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>冻结评审结论</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-[13px]">
          <div className="text-slate-500">发起人 {review.initiator} · {formatDateTime(review.createdAt)}</div>
          {review.reviewers.map((r) => (
            <div key={`${r.role}-${r.name}`} className="flex items-center gap-2 rounded border px-2 py-1.5">
              <span className="w-28 shrink-0 text-slate-500">{r.role}</span>
              <span className="flex-1">{r.name}</span>
              {r.decision ? (
                <span className={r.decision === '同意' ? 'text-emerald-600' : 'text-red-600'}>{r.decision}</span>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="h-6 px-2 text-[12px]"
                    onClick={() => {
                      const st = decideFreezeReview(review.id, r.role, r.name, '同意')
                      if (st === '已通过') toast.success('全部同意，产品已基线并冻结')
                    }}
                  >
                    同意
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-7 px-2 text-red-600"
                    onClick={() => {
                      decideFreezeReview(review.id, r.role, r.name, '驳回')
                      toast.message(`${r.role} 已驳回，冻结评审未通过`)
                    }}
                  >
                    驳回
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangeDialog({
  open,
  onOpenChange,
  project,
  freeze,
  hasOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  freeze?: FreezeReview
  hasOpenChange: boolean
}) {
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [scope, setScope] = useState('')
  const [initiator, setInitiator] = useState(currentActor())

  const submit = () => {
    if (hasOpenChange) {
      toast.error('已有进行中的变更，请先完成或驳回后再发起新变更')
      return
    }
    if (freeze?.status !== '已通过' && project.status !== '已基线' && project.status !== '变更中') {
      toast.error('请先完成需求冻结评审并基线，再通过变更系统申请修改')
      return
    }
    if (!title.trim() || !reason.trim()) {
      toast.error('请填写变更标题和原因')
      return
    }
    startChangeRequest(project.id, { title, reason, scope, initiator })
    toast.success('已发起变更申请，审批通过后才可修改需求')
    setTitle('')
    setReason('')
    setScope('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>发起变更申请</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[12.5px] text-slate-600">已基线产品的需求变更必须走变更系统，审批通过后进入「变更中」。</p>
          <div className="grid gap-1">
            <Label>标题</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>变更原因</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>影响范围</Label>
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="可选：涉及的需求编号、模组、验证计划" />
          </div>
          <div className="grid gap-1">
            <Label>发起人</Label>
            <Input value={initiator} onChange={(e) => setInitiator(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit}>提交变更</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangeHistoryDialog({
  open,
  onOpenChange,
  changes,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  changes: ChangeRequest[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>变更历史（{changes.length}）</DialogTitle>
        </DialogHeader>
        <div className="max-h-[420px] space-y-3 overflow-auto text-[13px]">
          {changes.length === 0 ? <div className="py-8 text-center text-slate-400">暂无变更记录</div> : null}
          {changes.map((c) => (
            <div key={c.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.title}</span>
                <span className="text-[11px] text-slate-500">{c.status}</span>
              </div>
              <div className="mt-1 text-slate-600">{c.reason}</div>
              {c.scope ? <div className="mt-1 text-[12px] text-slate-400">范围：{c.scope}</div> : null}
              <ul className="mt-2 space-y-1 text-[12px] text-slate-500">
                {c.history.map((h, i) => (
                  <li key={i}>
                    {formatDateTime(h.at)} · {h.by} · {h.action}
                    {h.comment ? `（${h.comment}）` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
