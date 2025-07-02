// app/utils/session.server.ts
import { createCookie, redirect } from "@remix-run/node";
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET must be set in your .env file");
}

const sessionCookie = createCookie("session-token", {
  secrets: [jwtSecret],
  httpOnly: true,
  maxAge: 60 * 60 * 24, // 1天
  path: "/",
  sameSite: "lax",
});

/**
 * 登录成功后调用此函数，将Token存入Cookie
 */
export async function createUserSession(accessToken: string, redirectTo: string) {
  const cookieValue = await sessionCookie.serialize(accessToken);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookieValue,
    },
  });
}

/**
 * 从请求中解析Cookie，返回用户信息（用于页面访问控制）
 */
export async function getSessionUser(request: Request): Promise<{ username: string } | null> {
  const accessToken = await sessionCookie.parse(request.headers.get("Cookie"));
  if (!accessToken || typeof accessToken !== 'string') return null;
  try {
    const payload = jwt.verify(accessToken, jwtSecret) as { sub: string };
    return { username: payload.sub };
  } catch (error) {
    return null;
  }
}

/**
 * 【新增】从请求中解析Cookie，返回原始的accessToken（用于WebSocket认证）
 */
export async function getAuthToken(request: Request): Promise<string | null> {
    const cookieString = request.headers.get("Cookie");
    const token = await sessionCookie.parse(cookieString);
    if (!token || typeof token !== 'string') {
        return null;
    }
    return token;
}


/**
 * 登出时调用此函数
 */
export async function logout(request: Request) {
  return redirect("/auth", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}
