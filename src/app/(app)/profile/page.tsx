"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/Shell";
import { PostSkeleton } from "@/components/ui";

export default function OwnProfileRedirect() {
  const { me, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (me) router.replace(`/profile/${me.id}`);
  }, [me, router]);

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <PostSkeleton />
      {loading && <PostSkeleton />}
    </div>
  );
}
