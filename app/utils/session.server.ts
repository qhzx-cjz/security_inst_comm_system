// app/utils/session.server.ts
import { createCookie, redirect } from "@remix-run/node";

// 定义与后端返回的 user 对象匹配的类型
export type SessionUser = {
  username: string;
  hasPublicKey: boolean;
};

// 定义会话中存储的数据结构
type SessionData = {
  token: string;
  user: SessionUser;
};

// 创建一个更安全的、用于存储会话数据的 cookie
const sessionCookie = createCookie("session-data", {
  // 必须在 .env 文件中设置一个安全的 SESSION_SECRET
  secrets: [process.env.SESSION_SECRET || "a-very-secret-key-for-dev"],
  httpOnly: true,
  maxAge: 60 * 60 * 24, // 1 天
  path: "/",
  sameSite: "lax",
});

/**
 * 创建用户会话，将包含用户对象和Token的数据存入Cookie，并重定向
 * @param sessionData - 需要存入会话的数据
 * @param redirectTo - 重定向的目标路径
 */
export async function createUserSession(sessionData: SessionData, redirectTo: string) {
  const cookieValue = await sessionCookie.serialize(sessionData);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": cookieValue,
    },
  });
}

/**
 * 从请求的Cookie中获取完整的会话数据
 * @param request - The incoming Request object.
 * @returns 包含用户和Token的会话数据，或在会话无效时返回 null
 */
export async function getSession(request: Request): Promise<SessionData | null> {
  const cookieString = request.headers.get("Cookie");
  const sessionData = await sessionCookie.parse(cookieString);
  if (!sessionData || typeof sessionData.token !== 'string' || typeof sessionData.user !== 'object') {
    return null;
  }
  return sessionData as SessionData;
}

/**
 * 登出用户，清除会话Cookie
 */
export async function logout(request: Request) {
  return redirect("/auth", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", {
        maxAge: 0,
      }),
    },
  });
}

// --- 辅助函数，方便在 loader 中获取会话的不同部分 ---

/**
 * 从会话中获取用户对象
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
    const session = await getSession(request);
    return session?.user ?? null;
}

/**
 * 从会话中获取认证Token
 */
export async function getAuthToken(request: Request): Promise<string | null> {
    const session = await getSession(request);
    return session?.token ?? null;
}
