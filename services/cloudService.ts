import { InvoiceRecord, Property, ExtractedInvoiceData, KsefInvoice } from "../types";

/**
 * NOTE: In a real production app, this file would communicate with a backend server
 * (e.g., Firebase Functions, AWS Lambda) which handles the secure server-side
 * OAuth2 authentication with Google Drive and Google Sheets APIs.
 * 
 * For this frontend-only demo, we simulate the network delay and storage logic
 * using LocalStorage and timeouts.
 */

const STORAGE_KEY_PROPERTIES = 'estate_ai_properties';
const STORAGE_KEY_INVOICES = 'estate_ai_invoices';

// --- Properties Management ---

export const getProperties = async (): Promise<Property[]> => {
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      const stored = localStorage.getItem(STORAGE_KEY_PROPERTIES);
      if (stored) {
        resolve(JSON.parse(stored));
      } else {
        // Default properties for demo - merged name/address concept
        const defaults: Property[] = [
          { id: '1', name: 'ul. Wiśniowa 12/4, Warszawa', address: 'ul. Wiśniowa 12/4, Warszawa', isArchived: false, driveFolderId: 'folder_123' },
          { id: '2', name: 'Al. Jerozolimskie 50, Warszawa', address: 'Al. Jerozolimskie 50, Warszawa', isArchived: false, driveFolderId: 'folder_456' },
          { id: '3', name: 'ul. Długa 5, Kraków', address: 'ul. Długa 5, Kraków', isArchived: true, driveFolderId: 'folder_789' },
        ];
        localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(defaults));
        resolve(defaults);
      }
    }, 500);
  });
};

export const saveProperty = async (property: Property): Promise<Property> => {
  const properties = await getProperties();
  const exists = properties.find(p => p.id === property.id);
  
  let newProperties;
  if (exists) {
    newProperties = properties.map(p => p.id === property.id ? property : p);
  } else {
    // Simulate creating a Drive Folder for the new property
    const newProp = { ...property, driveFolderId: `folder_${Date.now()}` };
    newProperties = [...properties, newProp];
  }
  
  localStorage.setItem(STORAGE_KEY_PROPERTIES, JSON.stringify(newProperties));
  return property;
};

// --- Invoice Processing (Mocking Drive & Sheets) ---

export const uploadInvoiceToCloud = async (
  invoiceData: ExtractedInvoiceData & { propertyId: string; fileData?: string; mimeType?: string }
): Promise<{ driveLink?: string; sheetRow: number }> => {
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        let driveLink: string | undefined = undefined;

        // 1. Mock Upload to Google Drive (Only if file exists)
        if (invoiceData.fileData && invoiceData.mimeType) {
            // In real app: Drive API files.create() into specific folder ID
            driveLink = `https://drive.google.com/drive/folders/mock_id_${Math.floor(Math.random() * 1000)}`;
            console.log(`[MOCK CLOUD] Uploaded ${invoiceData.mimeType} to Drive Folder for Property ${invoiceData.propertyId}`);
        } else {
            console.log(`[MOCK CLOUD] Manual entry - skipping Drive upload`);
        }

        // 2. Mock Append to Google Sheet
        // In real app: Sheets API spreadsheets.values.append()
        const sheetRow = Math.floor(Math.random() * 100) + 2; // Row 2+

        // Save local history for the demo
        const historyRaw = localStorage.getItem(STORAGE_KEY_INVOICES);
        const history = historyRaw ? JSON.parse(historyRaw) : [];
        const newRecord: InvoiceRecord = {
            ...invoiceData,
            id: Date.now().toString(),
            fileMimeType: invoiceData.mimeType || '',
            fileData: invoiceData.fileData || undefined,
            driveLink,
            sheetRow
        };
        localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify([newRecord, ...history]));

        console.log(`[MOCK CLOUD] Appended row to Sheets:`, invoiceData);

        resolve({ driveLink, sheetRow });
      } catch (e) {
        reject(e);
      }
    }, 1000); // 1 second upload simulation
  });
};

export const getRecentInvoices = (): InvoiceRecord[] => {
    const historyRaw = localStorage.getItem(STORAGE_KEY_INVOICES);
    return historyRaw ? JSON.parse(historyRaw) : [];
}

// --- KSeF Mock ---

export const getPendingKsefInvoices = async (): Promise<KsefInvoice[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock data as per prompt
      const mockData: KsefInvoice[] = [
        {
          id: 'ksef_1',
          sellerName: 'Castorama Polska Sp. z o.o.',
          invoiceNumber: 'FV/2025/12/10/001',
          date: '2025-12-10',
          netAmount: 1000.41,
          vatAmount: 230.09,
          grossAmount: 1230.50,
          currency: 'PLN',
          suggestedCategory: 'Materiały budowlane'
        },
        {
          id: 'ksef_2',
          sellerName: 'Hurtownia Elektryczna MEGAWAT',
          invoiceNumber: 'HE/55/2025',
          date: '2025-12-11',
          netAmount: 450.00,
          vatAmount: 103.50,
          grossAmount: 553.50,
          currency: 'PLN',
          suggestedCategory: 'Instalacje'
        },
        {
            id: 'ksef_3',
            sellerName: 'PGE Obrót S.A.',
            invoiceNumber: 'PGE/123123/2025',
            date: '2025-12-12',
            netAmount: 200.00,
            vatAmount: 46.00,
            grossAmount: 246.00,
            currency: 'PLN',
            suggestedCategory: 'Media'
        }
      ];
      resolve(mockData);
    }, 800);
  });
};