import { fetchAllData } from "@/lib/sheets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchAllData();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message, apo: [], fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
