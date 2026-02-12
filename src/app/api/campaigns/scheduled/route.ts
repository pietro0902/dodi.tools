import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import {
  getScheduledCampaigns,
  addScheduledCampaign,
  saveScheduledCampaigns,
  type ScheduledCampaign,
} from "@/lib/scheduled-campaigns";
import { logActivity } from "@/lib/activity-log";
import { getQStashClient, getAppUrl } from "@/lib/qstash";

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

    const campaignId = crypto.randomUUID();

    // Publish to QStash with notBefore for delayed delivery
    const qstash = getQStashClient();
    const { messageId } = await qstash.publishJSON({
      url: getAppUrl("/api/cron/scheduled-campaigns"),
      body: { campaignId },
      notBefore: Math.floor(scheduledDate.getTime() / 1000),
      retries: 3,
    });

    const campaign: ScheduledCampaign = {
      id: campaignId,
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
      qstashMessageId: messageId,
    };

    await addScheduledCampaign(campaign);

    try {
      const dateStr = scheduledDate.toLocaleString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      await logActivity({
        type: "campaign_scheduled",
        summary: `Campagna '${body.subject}' programmata per ${dateStr}`,
        details: {
          subject: body.subject,
          recipientCount: body.recipientCount,
          scheduledAt: campaign.scheduledAt,
        },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

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

    const campaigns = await getScheduledCampaigns();
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return NextResponse.json(
        { error: `Campaign ${id} not found` },
        { status: 404 }
      );
    }

    // Cancel QStash message (may already have been delivered)
    if (campaign.qstashMessageId) {
      try {
        const qstash = getQStashClient();
        await qstash.messages.delete(campaign.qstashMessageId);
      } catch (err) {
        console.warn("Could not cancel QStash message (may already be delivered):", err);
      }
    }

    campaign.status = "cancelled";
    await saveScheduledCampaigns(campaigns);

    try {
      await logActivity({
        type: "campaign_cancelled",
        summary: `Campagna '${campaign.subject}' annullata`,
        details: { subject: campaign.subject },
      });
    } catch (logErr) {
      console.error("Activity log error:", logErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scheduled campaigns DELETE error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
