// app/routes/logout.tsx

import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { logout } from "~/utils/session.server"; // 我们将在下一步创建这个文件

export async function action({ request }: ActionFunctionArgs) {
  // 调用登出函数，它会清除cookie并返回重定向响应
  return logout(request);
}

// 这个路由只需要一个action，不需要UI，所以默认导出null
export default function LogoutRoute() {
  return null;
}