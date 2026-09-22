import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  LogOut,
  User,
  Users,
  UserCog,
  Mail,
  Package,
  HardDrive,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

interface NavItem {
  label: string;
  to: string;
  icon: typeof ClipboardList;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  manager: [
    { label: "Painel", to: "/manager", icon: LayoutDashboard },
    { label: "Ordens de Trabalho", to: "/work-orders", icon: ClipboardList },
    { label: "Clientes", to: "/clients", icon: Users },
    { label: "Equipamentos", to: "/equipments", icon: HardDrive },
    { label: "Funcionários", to: "/employees", icon: UserCog },
    { label: "Materiais", to: "/material-catalog", icon: Package },
    { label: "Emails", to: "/email-logs", icon: Mail },
  ],
  employee: [{ label: "Painel", to: "/employee", icon: LayoutDashboard }],
  client: [{ label: "Painel", to: "/client", icon: LayoutDashboard }],
};

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { profile, roles, signOut } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = roles[0] ?? "";
  const navItems = NAV_BY_ROLE[role] ?? [];

  const getRoleName = (r: string) => {
    switch (r) {
      case "manager":
        return "Gerente";
      case "employee":
        return "Funcionário";
      case "client":
        return "Cliente";
      default:
        return r;
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const isActive = (to: string) =>
    to === location.pathname || (to !== "/" && location.pathname.startsWith(to + "/"));

  const homeRoute = navItems[0]?.to ?? "/";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-3">
          {navItems.length > 1 && (
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <nav className="flex flex-col gap-1 p-4 pt-10">
                  {navItems.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive(item.to)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}

          <Link to={homeRoute} className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ClipboardList className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-semibold leading-tight">{title}</h1>
              {profile && role && (
                <p className="text-xs text-muted-foreground">{getRoleName(role)}</p>
              )}
            </div>
          </Link>

          {navItems.length > 1 && (
            <nav className="hidden md:flex items-center gap-1 ml-4 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive(item.to)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 dark:hidden" />
              <Moon className="hidden h-5 w-5 dark:block" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile ? getInitials(profile.name) : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{profile?.name}</p>
                    <p className="text-xs text-muted-foreground">{role ? getRoleName(role) : ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
