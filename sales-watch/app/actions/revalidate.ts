"use server";

import { revalidatePath } from "next/cache";
import { invalidateCache } from "@/lib/dataCache";

/**
 * Server Action: clear the in-memory data cache and revalidate all pages.
 * Called by the manual refresh button in the Navigation bar.
 */
export async function revalidateAllData(): Promise<void> {
  invalidateCache();
  // Revalidate the root layout so all pages get fresh server renders
  revalidatePath("/", "layout");
}
