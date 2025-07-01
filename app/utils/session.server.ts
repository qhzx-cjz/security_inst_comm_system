// app/utils/session.server.ts

import { createCookie, redirect } from "@remix-run/node";

// 1. 创建一个安全的、HttpOnly的cookie来存储session token
// 在真实项目中，secrets应该是从环境变量中读取的复杂字符串
const sessionCookie = createCookie("session", {
  secrets: ["s3cr3t"],
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: "/",
  sameSite: "lax",
});

// 这个函数会从我们刚刚创建的HttpOnly cookie中读取token
async function getToken(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie = (await sessionCookie.parse(cookieHeader)) || {};
  return cookie.token;
}

// 核心：这个函数现在体现了BFF模式
export async function getSessionUser(request: Request) {
  const token = await getToken(request);
  if (!token) {
    return null; // 用户未登录
  }

  try {
    // 2. Remix服务器(BFF)调用您的主后端API来验证token并获取用户状态
    // <<< 在这里替换为您的后端API地址 >>>
    const response = await fetch("http://localhost:8080/api/auth/status", {
      headers: {
        // 将token转发给后端API
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // 如果token无效或过期，API会返回401/403，我们也认为用户未登录
      return null;
    }

    // 3. API验证成功，返回用户信息
    const user = await response.json();
    return user;

  } catch (error) {
    // 如果后端API无法连接，也视为未登录
    console.error("Failed to fetch user status from API", error);
    return null;
  }
}

// 登录成功后，action中需要调用这个函数来设置cookie
export async function createUserSession(token: string, redirectTo: string) {
  const cookie = await sessionCookie.serialize({ token });
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookie,
    },
  });
}

// 登出函数现在需要清除cookie
export async function logout(request: Request) {
  return redirect("/auth", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}