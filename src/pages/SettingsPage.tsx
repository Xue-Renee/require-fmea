import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_ACCEPTANCE_METHODS,
  DEFAULT_CATEGORIES,
  DEFAULT_DISCIPLINES,
  DEFAULT_MODULES,
  DEFAULT_PART_ACCEPTANCE_METHODS,
} from '@/lib/constants'
import { listToLines, linesToList } from '@/lib/options'
import { getCustomOptions, resetCustomKey, saveCustomOptions, setRole, useAppStore } from '@/lib/store'
import type { CustomOptions } from '@/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function SettingsPage() {
  const { role, customOptions } = useAppStore()
  const readonly = role === 'member'

  return (
    <div className="h-full min-w-0 overflow-auto p-6">
      <h1 className="mb-4 text-lg font-semibold">系统设置</h1>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>当前角色</CardTitle>
          <CardDescription>
            管理员可以配置整个界面的选项（需求分类、涉及模块、涉及专业、验收方法、零件验收方式）；成员仅可查看配置，不能修改。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant={role === 'admin' ? 'default' : 'secondary'} onClick={() => setRole('admin')}>
            管理员
          </Button>
          <Button variant={role === 'member' ? 'default' : 'secondary'} onClick={() => setRole('member')}>
            成员
          </Button>
          <Badge variant="secondary">{role === 'admin' ? '管理员' : '成员'}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            界面选项配置
            {readonly ? <Badge>只读</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <OptionEditor
            title="需求分类"
            optionKey="categories"
            defaults={DEFAULT_CATEGORIES}
            custom={customOptions.categories}
            readonly={readonly}
          />
          <OptionEditor
            title="涉及模块"
            optionKey="modules"
            defaults={DEFAULT_MODULES}
            custom={customOptions.modules}
            readonly={readonly}
          />
          <OptionEditor
            title="涉及专业"
            optionKey="disciplines"
            defaults={DEFAULT_DISCIPLINES}
            custom={customOptions.disciplines}
            readonly={readonly}
          />
          <OptionEditor
            title="验收方法（产品/模块）"
            optionKey="acceptanceMethods"
            defaults={DEFAULT_ACCEPTANCE_METHODS}
            custom={customOptions.acceptanceMethods}
            readonly={readonly}
          />
          <OptionEditor
            title="验收方式（零件需求）"
            optionKey="partAcceptanceMethods"
            defaults={DEFAULT_PART_ACCEPTANCE_METHODS}
            custom={customOptions.partAcceptanceMethods}
            readonly={readonly}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function OptionEditor({
  title,
  optionKey,
  defaults,
  custom,
  readonly,
}: {
  title: string
  optionKey: keyof CustomOptions
  defaults: string[]
  custom?: string[]
  readonly: boolean
}) {
  const initial = listToLines(custom && custom.length ? custom : defaults)
  const [text, setText] = useState(initial)
  useEffect(() => {
    setText(listToLines(custom && custom.length ? custom : defaults))
  }, [custom, defaults])

  const dirty = text !== initial

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold">{title}</div>
        {!readonly && (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!dirty}
              onClick={() => {
                const list = linesToList(text)
                saveCustomOptions({ ...getCustomOptions(), [optionKey]: list })
                toast.success(`${title}已保存`)
              }}
            >
              保存
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                resetCustomKey(optionKey)
                setText(listToLines(defaults))
                toast.success(`${title}已恢复默认`)
              }}
            >
              恢复默认
            </Button>
          </div>
        )}
      </div>
      <Textarea
        className="min-h-[180px] font-sans"
        disabled={readonly}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  )
}
