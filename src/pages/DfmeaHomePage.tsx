import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function DfmeaHomePage() {
  const { db } = useAppStore()
  const navigate = useNavigate()

  return (
    <div className="h-full min-w-0 overflow-auto p-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-slate-900">DFMEA</h1>
        <p className="text-xs text-muted-foreground">
          针对产品需求做失效影响分析，针对模块需求做失效模式分析，针对零件需求做失效原因分析。需求不是失效项；在结构树节点下填写分析结果，在表格中做 SOD 风险分析。
        </p>
      </div>
      {db.projects.length === 0 ? (
        <div className="rounded-md border border-dashed bg-white py-16 text-center text-sm text-slate-400">
          请先在「项目与需求规格书」中创建项目并拆解需求。
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {db.projects.map((p) => {
            const reqs = db.requirements.filter((r) => r.projectId === p.id)
            const recs = db.dfmeaRecords.filter((r) => r.projectId === p.id)
            return (
              <Card key={p.id} className="cursor-pointer hover:border-primary/40" onClick={() => navigate(`/projects/${p.id}/dfmea`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{p.code}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}/dfmea`) }}>
                      <Share2 /> 打开
                    </Button>
                  </div>
                  <div className="mt-3 text-[12px] text-slate-500">
                    需求 {reqs.length} 条 · DFMEA 行 {recs.length} 条 · 状态 {p.status}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
