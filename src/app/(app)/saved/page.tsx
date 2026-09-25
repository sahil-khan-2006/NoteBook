"use client";

import { Bookmark } from "lucide-react";
import { FeedList } from "@/components/FeedList";
import { EmptyState } from "@/components/ui";
import { useApp } from "@/components/Shell";

export default function SavedPage() {
  const { me } = useApp();
  return (
    <div className="space-y-4 px-4 lg:px-0">
      <div>
        <h1 className="font-display text-xl font-bold text-ink">Saved</h1>
        <p className="mt-0.5 text-[13px] text-slate">
          Resources you bookmarked for later — revision week will thank you.
        </p>
      </div>
      <FeedList
        query={me ? `/api/posts?saved=${me.id}` : "/api/posts?saved=none"}
        empty={
          <EmptyState
            icon={<Bookmark size={26} />}
            title="No saved resources yet"
            body="Save useful academic resources and find them here later."
          />
        }
      />
    </div>
  );
}
