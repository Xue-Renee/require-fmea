import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateSampleProject } from '@/lib/sample'
import { createProject, deleteProject, useAppStore } from '@/lib/store'
import { FileStack, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export function HomePage() {
  const { db } = useAppStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [coreDesigners, setCoreDesigners] = useState('')
  const [description, setDescription] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const reset = () => {
    setName('')
    setCode('')
    setCoreDesigners('')
    setDescription('')
  }

  const submit = () => {
    if (!name.trim() || !code.trim()) {
      toast.error('请填写项目名称和编号前缀')
      return
    }
    const p = createProject({ name, code, coreDesigners, description })
    toast.success(`已创建项目「${p.name}」`)
    setOpen(false)
    reset()
    navigate(`/projects/${p.id}`)
  }

  const genSample = () => {
    const r = generateSampleProject()
    toast.success('已重新生成完整示例项目「结构光 3D 工业相机（CAM3D-2000）」')
    navigate(`/projects/${r.id}`)
  }

  const deleting = db.projects.find((p) => p.id === deletingId)

  return (
    <div className="h-full min-w-0 overflow-auto p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">项目与需求规格书</h1>
          <p className="text-xs text-muted-foreground">管理 EVT → DVT → PVT → MP 各阶段条目化需求</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={genSample}>
            <Sparkles /> 生成示例项目
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus /> 新建项目
          </Button>
        </div>
      </div>

      {db.projects.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed bg-white text-slate-500">
          <FileStack className="mb-2 h-10 w-10 text-slate-300" />
          <div>暂无项目，点击「新建项目」或「生成示例项目」开始</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {db.projects.map((p) => {
            const count = db.requirements.filter((r) => r.projectId === p.id).length
            return (
              <Card
                key={p.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-slate-900">{p.name}</div>
                      <div className="mt-1 inline-flex rounded bg-[#e8f4fb] px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        {p.code}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingId(p.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {p.coreDesigners ? (
                    <div className="mt-2 truncate text-xs text-slate-500">{p.coreDesigners}</div>
                  ) : null}
                  {p.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description}</div>
                  ) : null}
                  <div className="mt-3 text-xs text-slate-400">{count} 条需求</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>
                项目名称 <span className="text-red-500">*</span>
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：结构光 3D 工业相机" />
            </div>
            <div className="grid gap-1">
              <Label>
                编号前缀 <span className="text-red-500">*</span>
              </Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAM3D" />
            </div>
            <div className="grid gap-1">
              <Label>核心设计人员</Label>
              <Input value={coreDesigners} onChange={(e) => setCoreDesigners(e.target.value)} placeholder="产品经理：王工；SE：李工" />
            </div>
            <div className="grid gap-1">
              <Label>项目描述</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={submit}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingId != null} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除项目</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除项目「{deleting?.name}」及其全部需求与关联？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deletingId != null) {
                  deleteProject(deletingId)
                  toast.success('项目已删除')
                }
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
