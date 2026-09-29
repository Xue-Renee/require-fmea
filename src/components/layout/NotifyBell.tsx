import { markNotificationsRead, useAppStore } from '@/lib/store'
import { formatDateTime } from '@/lib/utils'
import { Bell } from 'lucide-react'
import { useState } from 'react'

export function NotifyBell() {
  const { db } = useAppStore()
  const unread = db.notifications.filter((n) => !n.read)
  const [open, setOpen] = useState(false)
  const list = db.notifications.slice(0, 20)

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        title="通知"
        onClick={() => {
          setOpen((v) => !v)
          if (unread.length) markNotificationsRead(unread.map((n) => n.id))
        }}
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 min-w-[14px] rounded-full bg-red-500 px-1 text-center text-[10px] leading-[14px] text-white">
            {unread.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-md border bg-white p-2 text-[12px] text-slate-700 shadow-lg">
          <div className="mb-1 font-semibold">提测通知</div>
          {list.length === 0 ? <div className="py-6 text-center text-slate-400">暂无通知</div> : null}
          <div className="max-h-64 space-y-1.5 overflow-auto">
            {list.map((n) => (
              <div key={n.id} className="rounded border px-2 py-1.5">
                <div className="font-medium">{n.title}</div>
                <div className="text-slate-500">{n.body}</div>
                <div className="text-[11px] text-slate-400">
                  致 {n.to} · {formatDateTime(n.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
