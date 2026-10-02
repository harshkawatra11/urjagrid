import type { ConsumerStatus } from "@/lib/api/types";

/** Pure title/label functions for the consumer phone app (D27). Hindi copy is grammatical
 * Devanagari, not transliteration placeholders. */

export const METER_STATE_LABEL_HI: Record<ConsumerStatus["meterState"], string> = {
  normal: "सामान्य",
  dr: "डिमांड रेस्पॉन्स सक्रिय",
  capped: "सीमित बिजली",
  shed: "बिजली बंद",
  offline: "मीटर ऑफ़लाइन",
};

export function weatherHeadline(status: ConsumerStatus | null | undefined): string {
  if (!status) return "आज की बिजली मौसम उपलब्ध नहीं है";
  return `आज की बिजली मौसम: ${METER_STATE_LABEL_HI[status.meterState]}`;
}

export function lifelineGuaranteeLine(wattage: number): string {
  return `चाहे जो भी हो, आपको कम से कम ${wattage} वॉट बिजली की गारंटी है — यह कभी बंद नहीं होगी।`;
}

export function availableHoursCount(blocks: ConsumerStatus["availabilityBlocks"]): number {
  return blocks.filter((b) => b === "available").length;
}

export function shedHoursCount(blocks: ConsumerStatus["availabilityBlocks"]): number {
  return blocks.filter((b) => b === "shed").length;
}
