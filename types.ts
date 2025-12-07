export interface Property {
  id: string;
  name: string;
  address: string;
  isArchived: boolean;
  driveFolderId?: string; // Mock ID for Google Drive folder
}

export interface ExtractedInvoiceData {
  sellerName: string;
  invoiceNumber: string;
  date: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  SELECT_METHOD = 'SELECT_METHOD',
  ANALYZING = 'ANALYZING',
  REVIEW = 'REVIEW',
  UPLOADING = 'UPLOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface InvoiceRecord extends ExtractedInvoiceData {
  id: string;
  propertyId: string;
  fileData: string; // Base64
  fileMimeType: string;
  driveLink?: string; // Mock link
  sheetRow?: number; // Mock row
}