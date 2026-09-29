import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DELIVERY_PHASES, REQ_STATUS, TR_STATES } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { TrState } from '@/types'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useParams } from 'react-router-dom'

const COLORS = ['#409AD6', '#00164B', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C', '#34495E', '#F39C12']
const TR_COLORS: Record<TrState, string> = {
  未评估: '#E6A23C',
  是: '#67C23A',
  否: '#F56C6C',
  不涉及: '#909399',
}

export function DashboardView() {
  const { id } = useParams()
  const { db } = useAppStore()
  const projectId = Number(id)
  const reqs = db.requirements.filter((r) => r.projectId === projectId)
  const total = reqs.length
  const baselined = reqs.filter((r) => r.status === '已基线').length
  const highRisk = reqs.filter((r) => r.riskLevel === '高').length
  const tr5Pass = reqs.filter((r) => r.tr5Accepted === '是').length
  const tr4Pass = reqs.filter((r) => r.tr4Verified === '是').length
  const tr5Rate = total ? Math.round((tr5Pass / total) * 100) : 0
  const basePct = total ? Math.round((baselined / total) * 100) : 0

  const catMap = new Map<string, number>()
  for (const r of reqs) {
    if ((r.level || '产品需求') === '零件需求') continue
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1)
  }
  const catData = [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const trGates = [
    { key: 'tr3DesignCovered', name: 'TR3' },
    { key: 'tr4Verified', name: 'TR4' },
    { key: 'tr4aPassed', name: 'TR4A' },
    { key: 'tr5Accepted', name: 'TR5' },
  ] as const
  const trData = trGates.map((g) => {
    const row: Record<string, string | number> = { name: g.name }
    for (const s of TR_STATES) {
      row[s] = reqs.filter((r) => r[g.key] === s).length
    }
    return row
  })

  const statusData = REQ_STATUS.map((s) => ({ name: s, value: reqs.filter((r) => r.status === s).length })).filter(
    (d) => d.value > 0,
  )
  const phaseData = DELIVERY_PHASES.map((s) => ({ name: s, value: reqs.filter((r) => r.deliveryPhase === s).length }))

  return (
    <div className="h-full min-w-0 overflow-auto">
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          title="需求总数"
          value={String(total)}
          sub={`产品 ${reqs.filter((r) => (r.level || '产品需求') === '产品需求').length} · 模块 ${reqs.filter((r) => r.level === '模块需求').length} · 零件 ${reqs.filter((r) => r.level === '零件需求').length}`}
        />
        <StatCard title="已基线" value={`${baselined}`} sub={`占比 ${basePct}%`} />
        <StatCard title="高实现难度条目" value={String(highRisk)} sub="设计实现难度 = 高" />
        <StatCard title="TR5 验收通过率" value={`${tr5Rate}%`} sub={`TR4 通过数 ${tr4Pass}`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ChartCard title="需求分类分布">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={catData} layout="vertical" margin={{ left: 24, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#409AD6" name="数量" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="TR 评审进展">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {TR_STATES.map((s) => (
                <Bar key={s} dataKey={s} stackId="tr" fill={TR_COLORS[s]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="状态分布">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((d, i) => (
                  <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="交付阶段分布">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={phaseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#00164B" name="数量" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </CardContent>
    </Card>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
