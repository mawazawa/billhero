import type { Attachment, ParsedMessage } from "@/utils/types";
import { captureException } from "@/utils/error";
import type { Logger } from "@/utils/logger";

export interface MistralOCRResult {
  attachmentId: string;
  filename: string;
  success: boolean;
  ocrText?: string;
  extractedData?: {
    documentType?: string;
    totalAmount?: number;
    dueDate?: string;
    vendor?: string;
    invoiceNumber?: string;
  };
  error?: string;
}

export interface EnrichedAttachment extends Attachment {
  ocrResult?: MistralOCRResult;
}

export interface EnrichedMessage extends ParsedMessage {
  enrichedAttachments?: EnrichedAttachment[];
}

// Mistral OCR API configuration
const MISTRAL_OCR_API_KEY = process.env.MISTRAL_OCR_API_KEY || "hC1LYTQD1in75X9JJG3ddegojXas99i5";
const MISTRAL_OCR_ENDPOINT = "https://api.mistral.ai/v1/ocr";

/**
 * Process PDF attachments using Mistral OCR 2505
 */
export async function processPDFAttachments(
  message: ParsedMessage,
  emailProvider: { getAttachment: (messageId: string, attachmentId: string) => Promise<{ data: string; size: number }> },
  logger: Logger,
): Promise<EnrichedMessage> {
  if (!message.attachments || message.attachments.length === 0) {
    return message;
  }

  const pdfAttachments = message.attachments.filter(
    (attachment) => attachment.mimeType === "application/pdf",
  );

  if (pdfAttachments.length === 0) {
    logger.info("No PDF attachments found");
    return message;
  }

  logger.info("Processing PDF attachments with Mistral OCR", {
    pdfCount: pdfAttachments.length,
    filenames: pdfAttachments.map((a) => a.filename),
  });

  const enrichedAttachments: EnrichedAttachment[] = [];

  for (const attachment of message.attachments) {
    if (attachment.mimeType === "application/pdf") {
      try {
        const ocrResult = await processPDFWithMistralOCR(
          message.id,
          attachment,
          emailProvider,
          logger,
        );
        
        enrichedAttachments.push({
          ...attachment,
          ocrResult,
        });
      } catch (error) {
        logger.error("Failed to process PDF with Mistral OCR", {
          filename: attachment.filename,
          error: error instanceof Error ? error.message : String(error),
        });
        
        enrichedAttachments.push({
          ...attachment,
          ocrResult: {
            attachmentId: attachment.attachmentId,
            filename: attachment.filename,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    } else {
      // Keep non-PDF attachments as-is
      enrichedAttachments.push(attachment);
    }
  }

  return {
    ...message,
    enrichedAttachments,
  };
}

/**
 * Process a single PDF with Mistral OCR 2505
 */
async function processPDFWithMistralOCR(
  messageId: string,
  attachment: Attachment,
  emailProvider: { getAttachment: (messageId: string, attachmentId: string) => Promise<{ data: string; size: number }> },
  logger: Logger,
): Promise<MistralOCRResult> {
  try {
    // Get the PDF attachment data
    const attachmentData = await emailProvider.getAttachment(messageId, attachment.attachmentId);
    
    logger.info("Retrieved PDF attachment", {
      filename: attachment.filename,
      size: attachmentData.size,
    });

    // Prepare the request to Mistral OCR API
    const formData = new FormData();
    
    // Convert base64 data to blob for the API
    const pdfBuffer = Buffer.from(attachmentData.data, "base64");
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    
    formData.append("file", pdfBlob, attachment.filename);
    formData.append("model", "mistral-ocr-2505");
    formData.append("include_json", "true"); // Request structured data extraction

    // Call Mistral OCR API
    const response = await fetch(MISTRAL_OCR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_OCR_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Mistral OCR API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    logger.info("Successfully processed PDF with Mistral OCR", {
      filename: attachment.filename,
      textLength: result.text?.length || 0,
    });

    // Extract structured data from OCR result if available
    const extractedData = extractBillingData(result);

    return {
      attachmentId: attachment.attachmentId,
      filename: attachment.filename,
      success: true,
      ocrText: result.text || "",
      extractedData,
    };
  } catch (error) {
    captureException(error, {
      extra: {
        messageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
      },
    });
    
    throw error;
  }
}

/**
 * Extract billing-related structured data from OCR results
 */
function extractBillingData(ocrResult: any): MistralOCRResult["extractedData"] {
  // This is a simple extraction - in production, you might want to use
  // AI/LLM to extract more sophisticated billing information
  
  const text = ocrResult.text || "";
  const json = ocrResult.json || {};
  
  // Try to extract total amount (common patterns)
  const amountPatterns = [
    /total[:\s]*\$?(\d+\.?\d*)/i,
    /amount[:\s]*\$?(\d+\.?\d*)/i,
    /\$(\d+\.?\d*)/,
  ];
  
  let totalAmount: number | undefined;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      totalAmount = parseFloat(match[1]);
      break;
    }
  }

  // Try to extract due date
  const dueDatePattern = /due[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
  const dueDateMatch = text.match(dueDatePattern);
  const dueDate = dueDateMatch ? dueDateMatch[1] : undefined;

  // Try to extract vendor/invoice number
  const invoicePattern = /invoice[:\s]*(#?\w+)/i;
  const invoiceMatch = text.match(invoicePattern);
  const invoiceNumber = invoiceMatch ? invoiceMatch[1] : undefined;

  // Try to extract vendor name (simplified - first line before "Invoice")
  const vendorPattern = /^([^\n]*?)(?:invoice|bill)/im;
  const vendorMatch = text.match(vendorPattern);
  const vendor = vendorMatch ? vendorMatch[1].trim() : undefined;

  // Determine document type
  let documentType: string | undefined;
  if (text.toLowerCase().includes("phone") || text.toLowerCase().includes("telecom")) {
    documentType = "phone_bill";
  } else if (text.toLowerCase().includes("legal") || text.toLowerCase().includes("attorney")) {
    documentType = "legal_invoice";
  } else if (text.toLowerCase().includes("invoice")) {
    documentType = "invoice";
  }

  return {
    documentType,
    totalAmount,
    dueDate,
    vendor,
    invoiceNumber,
  };
}

/**
 * Check if a message likely contains billing documents
 */
export function isLikelyBillingMessage(message: ParsedMessage): boolean {
  const subject = message.subject.toLowerCase();
  const from = message.headers.from.toLowerCase();
  
  const billingKeywords = [
    "invoice", "bill", "statement", "payment", "due", "attorney", "legal",
    "phone", "utility", "telecom", "mobile", "verizon", "at&t", "t-mobile",
  ];
  
  const hasBillingKeyword = billingKeywords.some(keyword => 
    subject.includes(keyword) || from.includes(keyword)
  );
  
  const hasPDFAttachments = message.attachments?.some(
    attachment => attachment.mimeType === "application/pdf"
  ) || false;
  
  return hasBillingKeyword && hasPDFAttachments;
}
