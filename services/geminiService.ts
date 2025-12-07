import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInvoiceData } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractInvoiceData = async (base64Data: string, mimeType: string): Promise<ExtractedInvoiceData> => {
  try {
    const model = "gemini-2.5-flash"; // Efficient for text extraction
    
    // Define the schema strictly to get clean JSON
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        sellerName: { type: Type.STRING, description: "Pełna nazwa sprzedawcy/wystawcy faktury" },
        invoiceNumber: { type: Type.STRING, description: "Numer faktury" },
        date: { type: Type.STRING, description: "Data wystawienia faktury (YYYY-MM-DD)" },
        netAmount: { type: Type.NUMBER, description: "Łączna kwota netto (liczba)" },
        vatAmount: { type: Type.NUMBER, description: "Łączna kwota VAT (liczba)" },
        grossAmount: { type: Type.NUMBER, description: "Łączna kwota brutto do zapłaty (liczba)" },
        currency: { type: Type.STRING, description: "Waluta (np. PLN, EUR)" },
      },
      required: ["sellerName", "netAmount", "vatAmount", "grossAmount"],
    };

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: "Przeanalizuj ten dokument faktury (obraz lub PDF). Wyciągnij kluczowe dane finansowe. Jeśli jakaś wartość nie jest jasna, oszacuj ją lub wstaw 0. Upewnij się, że kwoty są liczbami (np. 123.45).",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for factual extraction
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Brak odpowiedzi tekstowej z modelu.");

    const rawData = JSON.parse(jsonText);

    // Sanitize data to ensure empty strings for text and 0 for numbers if null/undefined
    const data: ExtractedInvoiceData = {
      sellerName: (rawData.sellerName && rawData.sellerName !== "null") ? rawData.sellerName : "",
      invoiceNumber: (rawData.invoiceNumber && rawData.invoiceNumber !== "null") ? rawData.invoiceNumber : "",
      date: (rawData.date && rawData.date !== "null") ? rawData.date : "",
      netAmount: typeof rawData.netAmount === 'number' ? rawData.netAmount : 0,
      vatAmount: typeof rawData.vatAmount === 'number' ? rawData.vatAmount : 0,
      grossAmount: typeof rawData.grossAmount === 'number' ? rawData.grossAmount : 0,
      currency: (rawData.currency && rawData.currency !== "null") ? rawData.currency : "PLN",
    };

    return data;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Nie udało się odczytać danych z pliku. Spróbuj ponownie lub wprowadź dane ręcznie.");
  }
};