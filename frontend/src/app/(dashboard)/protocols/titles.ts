/** Pure title/label functions for the Integrations page (D25). */

export function moneyshotTitle(totalMessages: number): string {
  return `${totalMessages.toLocaleString("en-IN")} protocol messages exchanged (all WIRED simulators)`;
}

export const PROTOCOL_LABEL: Record<string, string> = {
  hes: "HES / DLMS",
  ocpp: "OCPP 1.6J",
  openadr: "OpenADR 3",
  beckn: "Beckn / UEI",
  whatsapp: "WhatsApp",
  ivr: "IVR",
  sms: "SMS",
};

export function totalCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}
