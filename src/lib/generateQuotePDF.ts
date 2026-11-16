import { jsPDF } from "jspdf";
import { drawQuotePdf, type QuoteData } from "../../supabase/functions/_shared/quotePdf.ts";

export type { QuoteData, QuoteItem } from "../../supabase/functions/_shared/quotePdf.ts";

export function generateQuotePDF(data: QuoteData): Blob {
  return drawQuotePdf(new jsPDF(), data).output("blob");
}
