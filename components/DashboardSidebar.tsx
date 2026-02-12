'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  GraduationCap,
  Users,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
  X,
  UserCog,
  Key,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface UserProfile {
  full_name: string
  email: string
  role: string
}

interface DashboardSidebarProps {
  userProfile: UserProfile | null
  onLogout: () => void
  isMobileOpen: boolean
  onCloseMobile: () => void
}

export default function DashboardSidebar({ userProfile, onLogout, isMobileOpen, onCloseMobile }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const navItems = [
    {
      name: 'Home',
      href: '/dashboard',
      icon: Home,
      matchPaths: ['/dashboard']
    },
    {
      name: 'Schools',
      href: '/dashboard/schools',
      icon: GraduationCap,
      matchPaths: ['/dashboard/schools']
    },
    {
      name: 'Access Codes',
      href: '/dashboard/access-codes',
      icon: Key,
      matchPaths: ['/dashboard/access-codes']
    },
    {
      name: 'Campaigns',
      href: '/dashboard/campaigns',
      icon: BarChart3,
      matchPaths: ['/dashboard/campaigns']
    },
    {
      name: 'Safeguarding',
      href: '/dashboard/safeguarding',
      icon: Shield,
      matchPaths: ['/dashboard/safeguarding']
    },
  ]

  function isActive(matchPaths: string[]) {
    return matchPaths.some(path => {
      if (path === '/dashboard') {
        return pathname === path
      }
      return pathname?.startsWith(path)
    })
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          group flex flex-col fixed left-0 top-16 bottom-0 z-30
          transition-all duration-200 ease-in-out
          bg-card border-r border-border
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:w-16 lg:hover:w-52
        `}>
        {/* Close button (mobile only) */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Navigation */}
        <nav className="flex-1 p-2 pt-4 space-y-1 overflow-y-auto bg-card">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.matchPaths)

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                title={item.name}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-[hsl(var(--accent-subtle))] text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                <Icon className={`w-5 h-5 shrink-0 transition-colors ${
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-brand-teal'
                }`} />
                <span className="font-medium whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 overflow-hidden">
                  {item.name}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* User Menu */}
        <div className="p-2 border-t border-border bg-card">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={userProfile?.full_name || 'User'}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-all duration-200">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm shrink-0">
                {userProfile?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 overflow-hidden whitespace-nowrap">
                <div className="text-sm font-medium text-foreground truncate">
                  {userProfile?.full_name || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {userProfile?.email || ''}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-all duration-200 shrink-0 ${showUserMenu ? 'rotate-180' : ''} lg:opacity-0 lg:group-hover:opacity-100`} />
            </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
              <div className="px-4 py-3 bg-[hsl(var(--accent-subtle))] border-b border-border">
                <p className="text-sm font-medium text-foreground truncate">
                  {userProfile?.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userProfile?.role || 'member'}
                </p>
              </div>
              <Link
                href="/dashboard/account"
                onClick={onCloseMobile}
                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2 border-b border-border">
                <UserCog className="w-4 h-4 text-muted-foreground" />
                <span>Account Settings</span>
              </Link>
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2 group">
                <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                <span className="group-hover:text-destructive transition-colors">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  )
}
