import { NotifyBell } from '@/components/layout/NotifyBell'
import { clamp, cn } from '@/lib/utils'
import { LS_SIDEBAR } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { FolderKanban, PanelLeft, Settings, Share2 } from 'lucide-react'
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

type SidebarState = { width: number; collapsed: boolean }

function readSidebar(): SidebarState {
  try {
    const raw = localStorage.getItem(LS_SIDEBAR)
    if (!raw) return { width: 232, collapsed: false }
    const parsed = JSON.parse(raw) as Partial<SidebarState>
    return {
      width: typeof parsed.width === 'number' ? parsed.width : 232,
      collapsed: Boolean(parsed.collapsed),
    }
  } catch {
    return { width: 232, collapsed: false }
  }
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2', compact && 'justify-center px-1')}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="6" fill="#0B2A6B" />
        <path d="M7 23V9h4.1l4.9 9.8L20.9 9H25v14h-3.3V13.3L17.3 23h-2.6L10.3 13.3V23H7z" fill="#409AD6" />
      </svg>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="text-[10px] tracking-[0.14em] text-white/65">MECH-MIND</div>
          <div className="truncate text-[14px] font-semibold text-white">需求管理系统</div>
        </div>
      )}
    </div>
  )
}

export function AppLayout() {
  const { role } = useAppStore()
  const location = useLocation()
  const [sidebar, setSidebar] = useState<SidebarState>(readSidebar)

  useEffect(() => {
    localStorage.setItem(LS_SIDEBAR, JSON.stringify(sidebar))
  }, [sidebar])

  const width = sidebar.collapsed ? 64 : sidebar.width
  const roleLabel = role === 'admin' ? '管理员' : '成员'

  const onResize = (e: ReactMouseEvent) => {
    if (sidebar.collapsed) return
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebar.width
    const move = (ev: globalThis.MouseEvent) => {
      setSidebar((s) => ({ ...s, width: clamp(startW + ev.clientX - startX, 180, 420) }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f3f5f8]">
      <aside
        className="relative flex h-full shrink-0 flex-col text-white"
        style={{ width, background: '#00164B' }}
      >
        <div className="flex items-center justify-between">
          <Logo compact={sidebar.collapsed} />
          <button
            type="button"
            className="mr-2 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => setSidebar((s) => ({ ...s, collapsed: !s.collapsed }))}
            title={sidebar.collapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
        <nav className="mt-2 flex-1 space-y-1">
          <NavLink
            to="/"
            className={cn(
              'mx-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors',
              location.pathname === '/' || location.pathname.startsWith('/projects')
                ? 'bg-white/15 text-white'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
              sidebar.collapsed && 'justify-center px-0',
            )}
          >
            <FolderKanban className="h-4 w-4 shrink-0" />
            {!sidebar.collapsed && <span>项目与需求规格书</span>}
          </NavLink>
          <NavLink
            to="/dfmea"
            className={cn(
              'mx-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors',
              location.pathname.startsWith('/dfmea')
                ? 'bg-white/15 text-white'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
              sidebar.collapsed && 'justify-center px-0',
            )}
          >
            <Share2 className="h-4 w-4 shrink-0" />
            {!sidebar.collapsed && <span>DFMEA</span>}
          </NavLink>
          <NavLink
            to="/settings"
            className={cn(
              'mx-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors',
              location.pathname.startsWith('/settings')
                ? 'bg-white/15 text-white'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
              sidebar.collapsed && 'justify-center px-0',
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!sidebar.collapsed && <span>系统设置</span>}
          </NavLink>
        </nav>
        <div className="border-t border-white/10 px-3 py-3 text-[11px] leading-relaxed text-white/70">
          {sidebar.collapsed ? (
            <div className="text-center">{role === 'admin' ? '管' : '成'}</div>
          ) : (
            <>
              <div>本地用户 · {roleLabel}</div>
              <div>数据保存在本浏览器</div>
            </>
          )}
        </div>
        {!sidebar.collapsed && (
          <div
            className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize hover:bg-primary/60"
            onMouseDown={onResize}
          />
        )}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-8 shrink-0 items-center justify-end border-b bg-white px-3">
          <NotifyBell />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
