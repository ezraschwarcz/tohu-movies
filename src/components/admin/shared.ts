"use client";

// Types and helpers shared by the control room tabs (see AdminPanel.tsx).

import { getBrowserSupabase } from "@/lib/supabase/client";

export type Tab = "overview" | "insights" | "films" | "comments" | "members" | "emails" | "log" | "tools";

export type Overview = {
  members: number;
  members_7d: number;
  members_30d: number;
  admins: number;
  banned: number;
  films: number;
  hidden_films: number;
  comments: number;
  pending_comments: number;
  views_7d: number;
  views_30d: number;
  views_all: number;
  top_films: { slug: string; title: string; views: number }[];
  sources?: { source: string; members: number }[];
  recent: {
    action: string;
    target: string | null;
    detail: string | null;
    created_at: string;
    admin: string;
  }[];
};

export type AdminFilm = {
  slug: string;
  title: string;
  year: number;
  genre: string;
  director: string;
  cast_text: string;
  rating: string;
  runtime_minutes: number;
  synopsis: string;
  warnings: string;
  playback_id: string;
  is_hidden: boolean;
  poster_url: string | null;
  created_at: string;
  views: number;
  comments: number;
};

export type AdminComment = {
  id: string;
  film_slug: string;
  film_title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  user_id: string;
  display_name: string;
  is_banned: boolean;
  created_at: string;
  /** Only on the Reported list. */
  reports?: number;
  reasons?: string[];
};

export type Member = {
  id: string;
  email: string;
  display_name: string;
  avatar_preset: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_super_admin?: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  comments: number;
};

export type MemberCounts = {
  total: number;
  new_7d: number;
  admins: number;
  super_admins: number;
  banned: number;
};

export type LogRow = {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: string;
  admin: string;
};

export const RATINGS = ["PG", "PG 13", "R", "NR", "TV PG"] as const;
export const SETUP_NOTE =
  "This part needs the control-room database update. Run the file supabase/migrations/20261116_control_room.sql in the Supabase SQL Editor once, then reload this page.";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function day(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function explain(err: { message?: string; code?: string } | null): string {
  const text = err?.message ?? "";
  if (
    err?.code === "PGRST202" ||
    /could not find the function|schema cache/i.test(text)
  ) {
    return SETUP_NOTE;
  }
  return text || "Something went wrong. Try again.";
}

export async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getBrowserSupabase().rpc(fn, args);
  if (error) throw new Error(explain(error));
  return data as T;
}

/** A load that either worked or failed with a message, never throws. */
export type Loaded<T> = { data: T } | { error: string };
export async function settle<T>(work: Promise<T>): Promise<Loaded<T>> {
  try {
    return { data: await work };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
