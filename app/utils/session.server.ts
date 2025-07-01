// app/utils/session.server.ts
import { createCookie, redirect } from "@remix-run/node";
import jwt from 'jsonwebtoken';

// --- 终极调试日志 ---
// 这段代码在模块加载时就会执行，能告诉我们环境变量是否被正确加载
console.log("\n[SESSION_SERVER.TS] 模块加载时, process.env.JWT_SECRET 的值是:", process.env.JWT_SECRET);
// --------------------

const jwtSecret = process.env.JWT_SECRET;

// 为了防止程序因secret不存在而崩溃，我们提供一个备用值
const cookieSecrets = jwtSecret ? [jwtSecret] : ["fallback-secret-for-dev"];
if (!jwtSecret) {
  console.error("[警告!] JWT_SECRET 未在 .env 文件中定义或加载，正在使用备用密钥！这在生产环境中是不安全的！");
}

const sessionCookie = createCookie("session-token", {
  secrets: cookieSecrets,
  httpOnly: true,
  maxAge: 60 * 60 * 24,
  path: "/",
  sameSite: "lax",
});

export async function createUserSession(accessToken: string, redirectTo: string) {
  console.log("[createUserSession] 函数被调用");
  try {
    if (!accessToken) {
      throw new Error("传入 createUserSession 的 accessToken 为空或无效");
    }
    
    console.log("[createUserSession] 准备序列化cookie...");
    const cookieValue = await sessionCookie.serialize(accessToken);
    console.log("[createUserSession] Cookie序列化成功, 准备重定向...");
    
    return redirect(redirectTo, {
      headers: {
        "Set-Cookie": cookieValue,
      },
    });
  } catch (error) {
    console.error("\n--- createUserSession 中发生致命错误！---\n", error);
    // 抛出错误，让上层action的catch块处理
    throw error;
  }
}

// getSessionUser 和 logout 函数保持不变
export async function getSessionUser(request: Request): Promise<{ username: string } | null> {
  const cookieString = request.headers.get("Cookie");
  const accessToken = await sessionCookie.parse(cookieString);

  if (!accessToken || typeof accessToken !== 'string' || !jwtSecret) {
    return null;
  }

  try {
    const payload = jwt.verify(accessToken, jwtSecret) as { sub: string };
    return { username: payload.sub };
  } catch (error) {
    return null;
  }
}

export async function logout(request: Request) {
  return redirect("/auth", {
    headers: {
      "Set-Cookie": await sessionCookie.serialize("", { maxAge: 0 }),
    },
  });
}
