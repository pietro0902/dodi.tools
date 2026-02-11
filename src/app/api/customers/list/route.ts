import { NextRequest, NextResponse } from "next/server";
import { getOptInCustomers } from "@/lib/shopify";
import { getSessionFromRequest } from "@/lib/session-token";

export async function GET(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customers = await getOptInCustomers();

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
      })),
    });
  } catch (error) {
    console.error("Customers list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
