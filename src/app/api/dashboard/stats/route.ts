import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { getOptInCustomers } from "@/lib/shopify";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscribers = await getOptInCustomers();

    return NextResponse.json({
      subscriberCount: subscribers.length,
      webhooksActive: true,
      cronInterval: "24h",
      resendConfigured: !!process.env.RESEND_API_KEY,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
