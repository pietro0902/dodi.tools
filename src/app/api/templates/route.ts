import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session-token";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";
import {
  getCustomTemplates,
  addCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplate,
} from "@/lib/custom-templates";

export async function GET(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const custom = await getCustomTemplates();

    return NextResponse.json({
      defaults: CAMPAIGN_TEMPLATES,
      custom,
    });
  } catch (error) {
    console.error("Templates GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const template: CustomTemplate = {
      id: crypto.randomUUID(),
      name: body.name.trim(),
      description: body.description?.trim() || "",
      subject: body.subject?.trim() || "",
      preheader: body.preheader?.trim() || "",
      blocks: body.blocks || [],
      bgColor: body.bgColor || "#f9fafb",
      btnColor: body.btnColor || "#111827",
      containerColor: body.containerColor || "#ffffff",
      textColor: body.textColor || "#374151",
      createdAt: new Date().toISOString(),
    };

    await addCustomTemplate(template);

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Templates POST error:", error);
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

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    await updateCustomTemplate(body.id, {
      name: body.name.trim(),
      description: body.description?.trim() || "",
      subject: body.subject?.trim() || "",
      preheader: body.preheader?.trim() || "",
      blocks: body.blocks || [],
      bgColor: body.bgColor || "#f9fafb",
      btnColor: body.btnColor || "#111827",
      containerColor: body.containerColor || "#ffffff",
      textColor: body.textColor || "#374151",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Templates PUT error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!getSessionFromRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await deleteCustomTemplate(body.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Templates DELETE error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
