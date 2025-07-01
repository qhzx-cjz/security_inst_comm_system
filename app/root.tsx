import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import "./tailwind.css";
import { Navbar } from "./components/navbar"
import { json, type LoaderFunctionArgs } from "@remix-run/node"; // 导入 loader 类型和 json
import { useLoaderData } from "@remix-run/react"; // 导入 useLoaderData hook
import { getSessionUser } from "~/utils/session.server"; // 导入我们创建的session工具


// 创建一个 loader 函数来在服务器上获取数据
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSessionUser(request);
  return json({ user }); // 将用户信息通过json返回给前端
}

export function Layout({ children }: { children: React.ReactNode }) {

  const { user } = useLoaderData<typeof loader>();

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">
          {/* 在这里放置导航栏 */}
          <Navbar user={user} />
          {/* Outlet 用于渲染当前路由匹配的页面内容 */}
          <main className="flex-grow container mx-auto p-4 md:p-6">
            {children}
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

