import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useState, type ReactNode } from 'react'

export function FieldHelp({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold leading-none text-slate-500 hover:border-primary hover:text-primary',
            className,
          )}
          aria-label={title}
          onMouseEnter={() => setOpen(true)}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen((v) => !v)
          }}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 leading-relaxed"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 font-semibold text-slate-900">{title}</div>
        <div className="space-y-1.5 text-[12.5px] text-slate-600">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

export function CharacteristicHelp() {
  return (
    <FieldHelp title="特性符号说明">
      <p>关键特殊特性（CC）：涉及产品的终端客户的人身安全、国家法律法规的产品或过程特性。</p>
      <p>重要特殊特性（SC）：涉及产品的功能、性能、可装配性丧失或下降，引起客户严重抱怨的产品或过程特性。</p>
      <p>一般特殊特性（/）：关键特性、重要特性以外的产品特性。</p>
    </FieldHelp>
  )
}

export function ImportanceHelp() {
  return (
    <FieldHelp title="需求重要度说明">
      <p>MUST：必须达成。</p>
      <p>Should：需要定义底线指标和期望指标，底线指标必须达成；期望指标最好达成，不作为卡点项。</p>
      <p>Nice to have：期望性指标，最好能达成，不达成也不足为卡点项。</p>
    </FieldHelp>
  )
}

export function RiskHelp() {
  return (
    <FieldHelp title="设计实现难度说明">
      <p>高：行业内从未使用过的先进技术。</p>
      <p>中：行业内有应用先例，但是在我司首次应用。</p>
      <p>低：在我司应用已成熟。</p>
    </FieldHelp>
  )
}

export function AcceptanceHelp() {
  return (
    <FieldHelp title="验收方法说明">
      <p>型式试验：在产品定型或设计变更时，验证产品是否符合设计/标准要求。</p>
      <p>下线测试：在产品生产完成后进行全量检测。</p>
      <p>原型确认：通过目视、追溯、测量、供方测试报告确认等方式进行验收确认。TR4A-产品经理确认验收。</p>
      <p>供方测试：供应商端进行测试并提供测试报告，梅卡曼德进行验收。（可选）</p>
      <p>技术评审：通过仿真、同行评审等方式进行验收确认。（可选）</p>
    </FieldHelp>
  )
}

export function TrHelp() {
  return (
    <FieldHelp title="TR 评估说明">
      <p>TR3 设计是否已包含实现：设计方案是否已覆盖本需求。</p>
      <p>TR4 验证是否通过：设计验证是否通过。</p>
      <p>TR4A 需求是否通过：需求符合性确认是否通过。</p>
      <p>TR5 需求验收是否通过：验收是否通过。</p>
      <p>选择「是」时必须提交证据：上传附件，或链接到 PLM 文档。</p>
      <p>选择「不涉及」时必须写明不涉及的原因。</p>
    </FieldHelp>
  )
}

export function PartAcceptanceHelp() {
  return (
    <FieldHelp title="零件验收方式说明">
      <p>供应商测试：供应商端测试并提供报告。</p>
      <p>我司测试：我司实验室或产线测试验收。</p>
      <p>检验：来料 / 过程 / 出货检验。</p>
      <p>图纸/规格书：按图纸或规格书条款验收。</p>
      <p>供应商保证：供应商书面保证（质保或符合性声明）。</p>
      <p>文档保证：以技术文件、检测报告、认证文件等作为验收依据。</p>
      <p>可多选。</p>
    </FieldHelp>
  )
}

export function DfmeaHelp() {
  return (
    <FieldHelp title="需求拆解与 DFMEA 对应">
      <p>需求本身不是失效项。拆解结构用于明确要对哪一层做分析：</p>
      <p>针对产品需求做失效影响分析（FE），对应严重度 S。</p>
      <p>针对模块需求做失效模式分析（FM），针对零件需求做失效原因分析（FC）；频度 O 评估对象为失效模式 / 失效原因。</p>
      <p>失效影响、模式、原因共同对应探测度 D。</p>
      <p>每个需求可对应多条失效影响 / 模式 / 原因；结构树节点下用「+」新增，表格按组合展开为多行。</p>
      <p>结构分析三列来自产品 BOM：上一较高级别＝产品名称，关注要素＝所属模组，下一较低级别或特性类型＝零件名称。三者绑定同一零件，调整其中一列会联动另外两列，与需求拆解无关。</p>
      <p>结构树节点保持需求层级；节点下方填写对应分析结果。表格在拆解路径上做风险分析与优化。</p>
    </FieldHelp>
  )
}

export function SodSHelp() {
  return (
    <FieldHelp title="严重度 S 判定">
      <p>评估对象：失效后果。沿是/否路径确定 1–10 分。</p>
      <p>10 影响安全；9 不符合法规；8/7 基本功能丧失/降低；6/5 次要功能丧失/降低；4–2 用户恼怒范围；1 无可辨识影响。</p>
    </FieldHelp>
  )
}

export function SodOHelp() {
  return (
    <FieldHelp title="频度 O 判定">
      <p>评估对象：失效模式 / 失效原因。沿创新设计 → 新设计 → 相似设计 → 成熟设计路径打分。</p>
      <p>10/9 行业首创且几乎无经验；8/7 公司首创；6–4 相似设计；3/2 成熟设计；1 预防控制已消除失效。</p>
    </FieldHelp>
  )
}

export function SodDHelp() {
  return (
    <FieldHelp title="探测度 D 判定">
      <p>评估对象：失效影响 + 模式 + 原因能否被探测。</p>
      <p>无措施为 10/9；新方法为 8；冻结后探测 7–5；开模前探测 4–2；实践验证总能探测为 1。</p>
    </FieldHelp>
  )
}
