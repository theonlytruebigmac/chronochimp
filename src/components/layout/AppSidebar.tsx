"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListChecks, Settings, TerminalSquare, LayoutGrid, ShieldCheck, Eye } from 'lucide-react'; // Added Eye
import { cn } from '@/lib/utils';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import React from 'react';

const mainNavItems = [
  { href: '/dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
  { href: '/tasks' as const, label: 'My Tasks', icon: ListChecks },
  { href: '/views' as const, label: 'Views', icon: Eye }, // Added Views link
  { href: '/settings' as const, label: 'Settings', icon: Settings },
];

const bottomNavItems = [
  { href: '/admin' as const, label: 'Admin Panel', icon: ShieldCheck },
  { href: '/api-docs' as const, label: 'API Docs', icon: TerminalSquare },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" as="/dashboard" className="flex items-center justify-center gap-2 font-semibold text-primary">
          <span className="group-data-[collapsible=icon]:hidden text-3xl">ChronoChimp</span>
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="my-3" />
      <SidebarContent className="flex flex-col justify-between p-2">
        <SidebarMenu className="space-y-1">
          {mainNavItems.map((item) => (
            <SidebarMenuItem key={item.href} className="my-1">
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                className="py-3 px-3 h-auto"
              >
                <Link href={item.href} className="flex w-full items-center">
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="ml-3 text-base font-medium">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        
        <SidebarFooter className="mt-auto p-2">
          <SidebarSeparator className="my-3" />
          <SidebarMenu className="space-y-1">
            {bottomNavItems.map((item) => (
              <SidebarMenuItem key={item.href} className="my-1">
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={{ 
                    children: item.label
                  }}
                  className="justify-start py-3 px-3 h-auto"
                >
                  <Link href={item.href} className="flex w-full items-center">
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="ml-3 text-base font-medium group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
    </>
  );
}
