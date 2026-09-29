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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { downloadBomTemplate, exportProjectBom, importProjectBom } from '@/lib/excel'
import { BOM_MODULE_GROUPS } from '@/lib/constants'
import { canEditRequirements, createBomItem, deleteBomItem, updateBomItem, type BomItemDraft } from '@/lib/store'
import { reqLevel } from '@/lib/hierarchy'
import type { BomItem, Database, Project } from '@/types'
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

function emptyDraft(): BomItemDraft {
  return { partNo: '', name: '', moduleGroup: '', spec: '', qty: 1, unit: 'pcs', remark: '' }
}

function fromItem(item: BomItem): BomItemDraft {
  return {
    partNo: item.partNo,
    name: item.name,
    moduleGroup: item.moduleGroup ?? '',
    spec: item.spec ?? '',
    qty: item.qty,
    unit: item.unit ?? 'pcs',
    remark: item.remark ?? '',
  }
}

export function BomPage({ project, db }: { project: Project; db: Database }) {
  const items = useMemo(
    () => db.bomItems.filter((b) => b.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder),
    [db.bomItems, project.id],
  )
  const reqs = useMemo(
    () => db.requirements.filter((r) => r.projectId === project.id && reqLevel(r) === '零件需求'),
    [db.requirements, project.id],
  )
  const [keyword, setKeyword] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BomItem | null>(null)
  const [draft, setDraft] = useState<BomItemDraft>(emptyDraft)
  const [deleting, setDeleting] = useState<BomItem | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return items
    return items.filter((b) => `${b.partNo} ${b.name} ${b.moduleGroup ?? ''} ${b.spec ?? ''} ${b.remark ?? ''}`.toLowerCase().includes(kw))
  }, [items, keyword])

  const linkedCount = (id: number) => reqs.filter((r) => r.bomItemId === id).length
  const editGate = canEditRequirements(project.id)

  const guardEdit = () => {
    if (!editGate.ok) {
      toast.error(editGate.reason)
      return false
    }
    return true
  }

  const openCreate = () => {
    if (!guardEdit()) return
    setEditing(null)
    setDraft(emptyDraft())
    setFormOpen(true)
  }

  const openEdit = (item: BomItem) => {
    if (!guardEdit()) return
    setEditing(item)
    setDraft(fromItem(item))
    setFormOpen(true)
  }

  const save = () => {
    if (!draft.partNo.trim() || !draft.name.trim()) {
      toast.error('请填写物料编码和零件名称')
      return
    }
    if (!draft.moduleGroup?.trim()) {
      toast.error('请选择所属模组')
      return
    }
    const dup = items.find(
      (b) => b.partNo.trim().toLowerCase() === draft.partNo.trim().toLowerCase() && b.id !== editing?.id,
    )
    if (dup) {
      toast.error(`物料编码「${draft.partNo.trim()}」已存在`)
      return
    }
    if (!guardEdit()) return
    try {
      if (editing) {
        updateBomItem(editing.id, draft)
        toast.success(`已保存 ${draft.partNo.trim()}`)
      } else {
        const created = createBomItem(project.id, draft)
        toast.success(`已新增零件 ${created.partNo}`)
      }
      setFormOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          placeholder="搜索物料编码 / 名称 / 规格"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="text-xs text-slate-500">共 {filtered.length} 项</div>
          <Button
            variant="secondary"
            onClick={async () => {
              await downloadBomTemplate()
              toast.success('已下载 BOM 导入模板.xlsx')
            }}
          >
            <Download /> 下载模板
          </Button>
          <Button variant="secondary" onClick={() => guardEdit() && fileRef.current?.click()}>
            <Upload /> 导入 Excel
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              await exportProjectBom(project)
              toast.success('已导出涉及零件')
            }}
          >
            <FileSpreadsheet /> 导出 Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus /> 新增零件
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) await importProjectBom(project, file)
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed bg-white text-sm text-slate-500">
          暂无涉及零件。请新增零件，或导入 Excel；零件需求将直接关联此处的具体零件。
        </div>
      ) : (
        <div className="req-table-wrap">
          <table className="req-table">
            <thead>
              <tr>
                <th className="sticky-col min-w-[140px]">物料编码</th>
                <th className="min-w-[140px]">所属模组</th>
                <th className="min-w-[160px]">零件名称</th>
                <th className="min-w-[180px]">规格型号</th>
                <th className="min-w-[72px]">数量</th>
                <th className="min-w-[72px]">单位</th>
                <th className="min-w-[100px]">关联零件需求</th>
                <th className="min-w-[180px]">备注</th>
                <th className="min-w-[90px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const n = linkedCount(item.id)
                return (
                  <tr key={item.id}>
                    <td className="sticky-col font-medium text-slate-800">{item.partNo}</td>
                    <td>{item.moduleGroup || <span className="text-slate-300">—</span>}</td>
                    <td>
                      <button type="button" className="text-left text-primary hover:underline" onClick={() => openEdit(item)}>
                        {item.name}
                      </button>
                    </td>
                    <td>{item.spec || <span className="text-slate-300">—</span>}</td>
                    <td>{item.qty ?? <span className="text-slate-300">—</span>}</td>
                    <td>{item.unit || <span className="text-slate-300">—</span>}</td>
                    <td>{n > 0 ? `${n} 条` : <span className="text-slate-300">—</span>}</td>
                    <td className="max-w-[240px] truncate" title={item.remark}>
                      {item.remark}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑BOM零件' : '新增BOM零件'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="grid gap-1">
              <Label>
                物料编码 <span className="text-red-500">*</span>
              </Label>
              <Input value={draft.partNo} onChange={(e) => setDraft((d) => ({ ...d, partNo: e.target.value }))} placeholder="如：CAM3D-P-001" />
            </div>
            <div className="grid gap-1">
              <Label>
                零件名称 <span className="text-red-500">*</span>
              </Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="如：投影镜头" />
            </div>
            <div className="col-span-2 grid gap-1">
              <Label>
                所属模组 <span className="text-red-500">*</span>
              </Label>
              <Select value={draft.moduleGroup || '__none'} onValueChange={(v) => setDraft((d) => ({ ...d, moduleGroup: v === '__none' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择零件所属模组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">请选择</SelectItem>
                  {BOM_MODULE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1">
              <Label>规格型号</Label>
              <Input value={draft.spec ?? ''} onChange={(e) => setDraft((d) => ({ ...d, spec: e.target.value }))} />
            </div>
            <div className="grid gap-1">
              <Label>数量</Label>
              <Input
                type="number"
                min={0}
                value={draft.qty ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value === '' ? undefined : Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-1">
              <Label>单位</Label>
              <Input value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="pcs" />
            </div>
            <div className="col-span-2 grid gap-1">
              <Label>备注</Label>
              <Textarea value={draft.remark ?? ''} onChange={(e) => setDraft((d) => ({ ...d, remark: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={save}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除BOM零件</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `确定删除「${deleting.partNo} ${deleting.name}」？${
                    linkedCount(deleting.id) ? `已有 ${linkedCount(deleting.id)} 条零件需求关联此零件，删除后将解除关联。` : ''
                  }`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleting) return
                try {
                  deleteBomItem(deleting.id)
                  toast.success(`已删除 ${deleting.partNo}`)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : '删除失败')
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
