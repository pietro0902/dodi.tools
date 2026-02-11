import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import {
  getScheduledCampaigns,
  addScheduledCampaign,
  updateCampaignStatus,
  type ScheduledCampaign,
} from "@/lib/scheduled-campaigns";

export async function GET(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await getScheduledCampaigns();
    const scheduled = campaigns.filter((c) => c.status === "scheduled");

    return NextResponse.json({ campaigns: scheduled });
  } catch (error) {
    console.error("Scheduled campaigns GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

interface ScheduleBody {
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  logoWidth: number;
  recipientMode: "all" | "manual";
  customerIds?: number[];
  scheduledAt: string;
  recipientCount: number;
}

export async function POST(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ScheduleBody = await request.json();

    if (!body.subject || !body.bodyHtml || !body.scheduledAt) {
      return NextResponse.json(
        { error: "subject, bodyHtml, and scheduledAt are required" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(body.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledAt date" },
        { status: 400 }
      );
    }

    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be in the future" },
        { status: 400 }
      );
    }

    const campaign: ScheduledCampaign = {
      id: crypto.randomUUID(),
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      ctaText: body.ctaText || "",
      ctaUrl: body.ctaUrl || "",
      logoWidth: body.logoWidth || 120,
      recipientMode: body.recipientMode || "all",
      customerIds: body.customerIds,
      scheduledAt: scheduledDate.toISOString(),
      status: "scheduled",
      createdAt: new Date().toISOString(),
      recipientCount: body.recipientCount || 0,
    };

    await addScheduledCampaign(campaign);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Scheduled campaigns POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    await updateCampaignStatus(id, "cancelled");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scheduled campaigns DELETE error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
