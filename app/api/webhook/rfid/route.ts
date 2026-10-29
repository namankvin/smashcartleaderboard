export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { handleRFIDScan, rfidOptions } from "@/lib/rfidScan";
// Preserve existing resolved-roll, UID and optional Bearer-token integrations.
export const OPTIONS = rfidOptions;
export function POST(request: NextRequest) { return handleRFIDScan(request, false); }
