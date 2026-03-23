import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import {
  SidebarProvider,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@corex/ui/components/sidebar";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@corex/ui/components/skeleton";
import {
  HomeIcon,
  CalendarIcon,
  TargetIcon,
  UserIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@corex/ui/components/card";
import { LoadingWrapper } from "@/components/renderers";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-[calc(100svh-1rem)] flex-col overflow-hidden">
        <header className="sticky top-0 z-10 shrink-0 p-4">
          <SidebarTrigger />
        </header>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppSidebar() {
  const { isPending, data: session } = authClient.useSession();
  const location = useLocation();
  const overviewLinks = [
    {
      to: "/dashboard",
      label: "Dashboard",
      icon: HomeIcon,
    },
  ] as const;
  const setupLinks = [
    {
      to: "/goals",
      label: "Goals",
      icon: TargetIcon,
    },
    {
      to: "/availability",
      label: "Availability",
      icon: CalendarIcon,
    },
  ] as const;

  return (
    <Sidebar variant="inset">
      <SidebarContent>
        <SidebarHeader>
          <div className="text-3xl font-extrabold italic">corex</div>
        </SidebarHeader>
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest uppercase">
            Overview
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {overviewLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.to}
                      render={
                        <Link to={item.to}>
                          <Icon /> {item.label}
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-widest uppercase">
            Training Setup
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {setupLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.to}
                      render={
                        <Link to={item.to}>
                          <Icon /> {item.label}
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <LoadingWrapper
          isLoading={isPending}
          fallback={<Skeleton className="h-18 w-full" />}
        >
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-accent/60 flex size-10 items-center justify-center rounded-md">
                  <UserIcon />
                </div>
                <CardTitle>{session?.user?.name}</CardTitle>
              </div>
              <ChevronRightIcon className="text-muted-foreground stroke-[1.5]" />
            </CardHeader>
          </Card>
        </LoadingWrapper>
      </SidebarFooter>
    </Sidebar>
  );
}
