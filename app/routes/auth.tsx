// app/routes/auth.tsx

import { ActionFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// 定义 action 函数返回的数据类型，方便在前端组件中获得类型提示
type ActionResponse = {
  ok: boolean;
  actionType?: "login" | "register";
  error?: string;
};

/**
 * 服务器端 Action 函数
 * 它的职责是接收前端表单，调用后端API，然后将结果返回给前端。
 */
export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const formData = await request.formData();
  const actionType = formData.get("_action") as "login" | "register";
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  // =================================================================
  // 登录逻辑
  // =================================================================
  if (actionType === "login") {
    try {
      // 1. 调用您的后端登录API
      // <<< 在这里替换为您的后端API地址 >>>
      const apiResponse = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      // 2. 如果API返回错误（如401 Unauthorized）
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        return json<ActionResponse>({
          ok: false,
          actionType: "login",
          error: errorData.message || "用户名或密码错误",
        }, { status: 401 });
      }

      // 3. 如果API调用成功，获取token
      const { token } = await apiResponse.json();
      
      // TODO: 将token存储到安全的HttpOnly Cookie中，并重定向到聊天主页
      console.log("登录成功, Token:", token);
      return redirect("/chat"); // <<< 登录成功后跳转到聊天页面

    } catch (error) {
      // 网络或其他未知错误
      return json<ActionResponse>({
        ok: false,
        actionType: "login",
        error: "无法连接到服务器，请稍后再试。",
      }, { status: 500 });
    }
  }

  // =================================================================
  // 注册逻辑
  // =================================================================
  if (actionType === "register") {
    const confirmPassword = formData.get("confirmPassword") as string;

    // 前端基础验证：两次密码是否一致
    if (password !== confirmPassword) {
      return json<ActionResponse>({
        ok: false,
        actionType: "register",
        error: "两次输入的密码不一致",
      }, { status: 400 });
    }
    
    try {
      // 1. 调用您的后端注册API
      // <<< 在这里替换为您的后端API地址 >>>
      const apiResponse = await fetch("http://localhost:8080/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      // 2. 如果API返回错误（如409 Conflict 用户名已存在）
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        return json<ActionResponse>({
          ok: false,
          actionType: "register",
          error: errorData.message || "注册失败，请重试",
        }, { status: apiResponse.status });
      }

      // 3. 注册成功，可以重定向到登录页并提示用户
      // 这里我们简单返回成功信息，也可以重定向 return redirect("/auth?registered=true");
      return json<ActionResponse>({ ok: true, actionType: "register" });

    } catch (error) {
      return json<ActionResponse>({
        ok: false,
        actionType: "register",
        error: "无法连接到服务器，请稍后再试。",
      }, { status: 500 });
    }
  }

  return json<ActionResponse>({ ok: false, error: "无效操作" }, { status: 400 });
}

/**
 * 客户端 UI 组件
 */
export default function AuthenticationPage() {
  // 使用 useActionData hook 来获取 action 函数的返回值
  const actionData = useActionData<ActionResponse>();

  return (
    <div className="flex justify-center items-center pt-16">
      <Tabs defaultValue="login" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">登录</TabsTrigger>
          <TabsTrigger value="register">注册</TabsTrigger>
        </TabsList>

        {/* 登录面板 */}
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>登录</CardTitle>
              <CardDescription>
                登录到您的账户以开始聊天。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form method="post" className="space-y-4">
                {/* 登录错误提示 */}
                {actionData?.actionType === 'login' && !actionData.ok && (
                  <p className="text-sm text-red-500">{actionData.error}</p>
                )}
                {/* 注册成功后的提示 */}
                {actionData?.actionType === 'register' && actionData.ok && (
                    <p className="text-sm text-green-500">注册成功！现在您可以登录了。</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-username">用户名</Label>
                  <Input id="login-username" name="username" type="text" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">密码</Label>
                  <Input id="login-password" name="password" type="password" required />
                </div>
                <Button type="submit" name="_action" value="login" className="w-full">
                  登录
                </Button>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 注册面板 */}
        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>注册</CardTitle>
              <CardDescription>
                创建一个新账户。
              </CardDescription>
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
                
                {/* 注册错误提示： 在这里添加 */}
                {actionData?.actionType === 'register' && !actionData.ok && (
                  <p className="text-sm text-red-500">{actionData.error}</p>
                )}
                
                <Button type="submit" name="_action" value="register" className="w-full">
                  创建账户
                </Button>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}