import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function Index() {
  const user = await getSessionUser();
  redirect(user ? "/home" : "/login");
}
