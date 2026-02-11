import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import {
  getAutomationSettings,
  saveAutomationSettings,
  type AutomationSettings,
} from "@/lib/automation-settings";

export async function GET(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getAutomationSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get automation settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: AutomationSettings = await request.json();

    // Basic validation
    if (typeof body.welcome?.enabled !== "boolean" || typeof body.abandonedCart?.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid settings format" },
        { status: 400 }
      );
    }

    await saveAutomationSettings(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save automation settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
