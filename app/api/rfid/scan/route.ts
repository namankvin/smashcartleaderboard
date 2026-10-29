export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest } from "next/server";
import { handleRFIDScan, rfidOptions, rfidSpecification } from "@/lib/rfidScan";
export const dynamic = "force-dynamic";
export const GET = rfidSpecification;
export const OPTIONS = rfidOptions;
export function POST(request: NextRequest) { return handleRFIDScan(request); }
