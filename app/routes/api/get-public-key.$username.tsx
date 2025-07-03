// app/routes/api/get-public-key.$username.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getAuthToken } from "~/utils/session.server";

// 这个loader函数就是一个API端点
export async function loader({ request, params }: LoaderFunctionArgs) {
  const token = await getAuthToken(request);
  if (!token) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = params.username;
  if (!username) {
    return json({ error: "Username is required" }, { status: 400 });
  }

  try {
    // 调用主后端的API
    const response = await fetch(`http://127.0.0.1:8000/api/users/${username}/key`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return json({ error: "Failed to fetch public key" }, { status: response.status });
    }

    const data = await response.json();
    return json({ publicKey: data.publicKey });

  } catch (error) {
    return json({ error: "Internal Server Error" }, { status: 500 });
  }
}
