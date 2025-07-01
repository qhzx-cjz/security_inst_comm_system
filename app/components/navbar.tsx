// app/components/navbar.tsx

import { Link, Form } from "@remix-run/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";

// 定义 Navbar 接收的 props 类型
type NavbarProps = {
  user: { username: string } | null;
};

export function Navbar({ user }: NavbarProps) {
  return (
    <nav className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 左侧标题 */}
        <Link to="/" className="text-xl font-bold tracking-tight">
          安全即时通讯系统
        </Link>

        {/* 右侧用户区域 */}
        <div className="flex items-center gap-4">
          {user ? (
            // 如果用户已登录，显示头像和下拉菜单
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-9 w-9">
                    {/* 你可以将来为用户添加头像URL */}
                    <AvatarImage src="" alt={user.username} />
                    <AvatarFallback>
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.username}
                    </p>
                    {/* <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p> */}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  {/* "登出" 是一个表单提交，而不是一个简单的链接 */}
                  <Form method="post" action="/logout" className="w-full">
                    <button type="submit" className="w-full text-left">
                      登出
                    </button>
                  </Form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // 如果用户未登录，显示登录/注册按钮
            <Button asChild>
              <Link to="/auth">登录 / 注册</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}