import { NextResponse } from "next/server";
import { joinWaitlist } from "@/lib/waitlist";

export async function POST(request: Request) {
  let body: { email?: string; source?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const result = await joinWaitlist(body.email ?? "", body.source);
  const httpStatus =
    result.status === "success" || result.status === "exists"
      ? 200
      : result.status === "invalid"
        ? 400
        : 502;

  return NextResponse.json(result, { status: httpStatus });
}
