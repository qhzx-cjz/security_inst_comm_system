// app/routes/auth.tsx

import { ActionFunctionArgs, json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { createUserSession } from "~/utils/session.server";

const API_URL = "http://localhost:8000";

type ActionResponse = {
  ok: boolean;
  actionType?: "login" | "register";
  error?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const actionType = formData.get("_action") as "login" | "register";
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (actionType === "register") {
      const confirmPassword = formData.get("confirmPassword") as string;
      if (password !== confirmPassword) {
        return json<ActionResponse>({ ok: false, actionType: "register", error: "两次输入的密码不一致" }, { status: 400 });
      }
      
      const response = await fetch(`${API_URL}/api/user/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return json<ActionResponse>({ ok: false, actionType: "register", error: errorData.detail || "注册失败" }, { status: response.status });
      }
      return json<ActionResponse>({ ok: true, actionType: "register" });
    }

    if (actionType === "login") {
      const response = await fetch(`${API_URL}/api/user/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return json<ActionResponse>({ ok: false, actionType: "login", error: errorData.detail || "用户名或密码错误" }, { status: response.status });
      }

      const data = await response.json();
      const accessToken = data.accessToken;

      if (!accessToken) {
        throw new Error("从后端返回的数据中未找到 accessToken");
      }

      return await createUserSession(accessToken, "/chat");

    }
    
    return json<ActionResponse>({ ok: false, error: "无效操作" }, { status: 400 });

  } catch (error) {
    console.error("Auth Action Error:", error);
    return json({ error: "服务器内部发生未知错误。" }, { status: 500 });
  }
}

// UI组件部分
export default function AuthenticationPage() {
  const actionData = useActionData<ActionResponse>();
  return (
    <div className="flex justify-center items-center pt-16">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>登录</CardTitle>
              <CardDescription>登录到您的账户以开始聊天。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form method="post" className="space-y-4">
                {actionData?.actionType === 'login' && !actionData.ok && (
                  <p className="text-sm text-red-500">{actionData.error}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-username">用户名</Label>
                  <Input id="login-username" name="username" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input id="login-password" name="password" type="password" required />
                </div>
                <Button type="submit" name="_action" value="login" className="w-full">登录</Button>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>注册</CardTitle>
              <CardDescription>创建一个新账户。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form method="post" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">用户名</Label>
                  <Input id="reg-username" name="username" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">密码</Label>
                  <Input id="reg-password" name="password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirmPassword">确认密码</Label>
                  <Input id="reg-confirmPassword" name="confirmPassword" type="password" required />
                </div>
                {actionData?.actionType === 'register' && !actionData.ok && (
                  <p className="text-sm text-red-500">{actionData.error}</p>
                )}
                {actionData?.actionType === 'register' && actionData.ok && (
                  <p className="text-sm text-green-500">注册成功！现在您可以登录了。</p>
                )}
                <Button type="submit" name="_action" value="register" className="w-full">创建账户</Button>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
