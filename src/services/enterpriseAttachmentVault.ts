export type AttachmentPolicy = {
  documentType: string;
  required: boolean;
  bucket: string;
  examples: string[];
};

export const attachmentPolicies: AttachmentPolicy[] = [
  { documentType: 'supplier', required: true, bucket: 'supplier-documents', examples: ['VAT certificate', 'CR', 'bank letter'] },
  { documentType: 'purchase_order', required: false, bucket: 'purchase-documents', examples: ['quotation', 'approval note'] },
  { documentType: 'grn', required: true, bucket: 'purchase-documents', examples: ['delivery note', 'receiving photo'] },
  { documentType: 'supplier_invoice', required: true, bucket: 'finance-documents', examples: ['supplier invoice PDF/image'] },
  { documentType: 'payment_voucher', required: true, bucket: 'finance-documents', examples: ['bank transfer receipt'] },
  { documentType: 'stock_count', required: true, bucket: 'stock-count-documents', examples: ['signed count sheet'] },
  { documentType: 'manual_journal', required: false, bucket: 'finance-documents', examples: ['supporting calculation', 'approval memo'] },
];
