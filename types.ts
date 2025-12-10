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

export interface KsefInvoice extends ExtractedInvoiceData {
  id: string;
  // Category removed as per requirements
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  SELECT_METHOD = 'SELECT_METHOD',
  ANALYZING = 'ANALYZING',
  REVIEW = 'REVIEW',
  UPLOADING = 'UPLOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  KSEF_INBOX = 'KSEF_INBOX'
}

export interface InvoiceRecord extends ExtractedInvoiceData {
  id: string;
  propertyId: string;
  fileData?: string; // Base64 - Optional for manual entry
  fileMimeType?: string; // Optional for manual entry
  driveLink?: string; // Mock link
  sheetRow?: number; // Mock row
}

export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface AppSettings {
  sheetFolder: string;
  scansFolder: string;
}