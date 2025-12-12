import React, { useState, useEffect, useRef } from 'react';
import { 
  Property, 
  ProcessingStatus, 
  ExtractedInvoiceData, 
  InvoiceRecord,
  User,
  KsefInvoice
} from './types';
import { extractInvoiceData } from './services/geminiService';
import { getProperties, saveProperty, uploadInvoiceToCloud, getRecentInvoices, getPendingKsefInvoices } from './services/cloudService';
import { authService } from './services/authService';
import { Spinner } from './components/Spinner';
import { PropertyManager } from './components/PropertyManager';
import { SettingsModal } from './components/SettingsModal';
import { Login } from './components/Login';

const App: React.FC = () => {
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('profit_lens_theme');
    return saved === 'dark';
  });

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // App State
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [fileData, setFileData] = useState<string | null>(null); // base64
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<ExtractedInvoiceData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // KSeF State
  const [ksefInvoices, setKsefInvoices] = useState<KsefInvoice[]>([]);
  const [processingKsefId, setProcessingKsefId] = useState<string | null>(null);
  const [ksefPropertySelections, setKsefPropertySelections] = useState<{[key: string]: string}>({});

  // Modals State
  const [isPropertyManagerOpen, setIsPropertyManagerOpen] = useState(false);
  const [propertyManagerInitialTab, setPropertyManagerInitialTab] = useState<'list' | 'add'>('list');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [history, setHistory] = useState<InvoiceRecord[]>([]);
  const [lastUploadLink, setLastUploadLink] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deep Link Handler
  const checkDeepLink = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setStatus(ProcessingStatus.SELECT_METHOD);
    }
  };

  // Initialize
  useEffect(() => {
    // Check for logged in user
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setIsAuthLoading(false);

    if (user) {
      loadAppData();
      checkDeepLink();
    }
  }, []);

  const loadAppData = async () => {
    const props = await getProperties();
    setProperties(props);
    setHistory(getRecentInvoices());
    
    // Fetch KSeF data on load to update the dashboard counter immediately
    try {
        const ksefPending = await getPendingKsefInvoices();
        setKsefInvoices(ksefPending);
    } catch (e) {
        console.error("Failed to load KSeF data on startup", e);
    }

    // Set default property to the first one available or previously selected
    if (props.length > 0 && !selectedPropertyId) {
        setSelectedPropertyId(props[0].id);
    }
  };

  // Theme Toggle Effect
  useEffect(() => {
    localStorage.setItem('profit_lens_theme', isDarkMode ? 'dark' : 'light');
    document.body.style.backgroundColor = isDarkMode ? '#050505' : '#F2F2F7'; // Apple system gray vs deep black
  }, [isDarkMode]);

  // Handlers
  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadAppData();
    checkDeepLink();
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setStatus(ProcessingStatus.IDLE);
    setInvoiceData(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFileData(base64);
        setFileMimeType(file.type);
        processFile(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const processFile = async (base64Full: string, mimeType: string) => {
    setStatus(ProcessingStatus.ANALYZING);
    setValidationErrors([]);
    try {
      const base64Content = base64Full.split(',')[1];
      // Pass properties to Gemini for address matching
      const result = await extractInvoiceData(base64Content, mimeType, properties);
      
      setInvoiceData(result);
      
      // Auto-select property if AI suggested one and it exists
      if (result.suggestedPropertyId) {
        const exists = properties.find(p => p.id === result.suggestedPropertyId);
        if (exists) {
          setSelectedPropertyId(exists.id);
        }
      }

      setStatus(ProcessingStatus.REVIEW);
    } catch (error) {
      console.error(error);
      alert("Błąd analizy danych.");
      setStatus(ProcessingStatus.SELECT_METHOD);
    }
  };

  // Handler for Manual Entry Mode
  const handleManualEntry = () => {
    setFileData(null);
    setFileMimeType('');
    setInvoiceData({
        sellerName: '',
        invoiceNumber: '',
        date: new Date().toISOString().split('T')[0],
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0, // In manual mode, user edits this directly
        currency: 'PLN'
    });
    setValidationErrors([]);
    setStatus(ProcessingStatus.REVIEW);
  };

  const handlePropertySave = async (prop: Property) => {
    const updated = await saveProperty(prop);
    const all = await getProperties();
    setProperties(all);
    if (!properties.find(p => p.id === updated.id)) {
      setSelectedPropertyId(updated.id);
    }
  };

  const handleSubmit = async () => {
    const errors: string[] = [];

    // Validation
    if (!selectedPropertyId) {
        errors.push("Wybierz nieruchomość z listy.");
    }

    if (invoiceData) {
        if (!invoiceData.sellerName || invoiceData.sellerName.trim() === '') {
            errors.push("Wprowadź nazwę sprzedawcy.");
        }
        if (!invoiceData.date) {
            errors.push("Wprowadź datę dokumentu.");
        }
        // Basic check for gross amount existence (assuming it shouldn't be null/undefined, though types say number)
        if (invoiceData.grossAmount === undefined || invoiceData.grossAmount === null) {
            errors.push("Wprowadź kwotę brutto.");
        }
    } else {
        errors.push("Brak danych faktury.");
    }

    if (errors.length > 0) {
        setValidationErrors(errors);
        // Scroll to errors? usually handled by layout
        return;
    }

    // Clear errors if any were present
    setValidationErrors([]);

    setStatus(ProcessingStatus.UPLOADING);
    try {
      let base64Content = undefined;
      if (fileData) {
        base64Content = fileData.split(',')[1];
      }
      
      const result = await uploadInvoiceToCloud({
        ...invoiceData!,
        propertyId: selectedPropertyId,
        fileData: base64Content,
        mimeType: fileMimeType
      });
      
      setLastUploadLink(result.driveLink || null);
      setHistory(getRecentInvoices());
      setStatus(ProcessingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      alert("Błąd chmury.");
      setStatus(ProcessingStatus.REVIEW);
    }
  };

  // --- KSeF Logic ---

  const handleOpenKsef = async () => {
      // If we already have invoices from initial load, just switch view. 
      // Otherwise fetch again (or refresh). Here we fetch to ensure fresh data.
      setStatus(ProcessingStatus.ANALYZING);
      try {
          const invoices = await getPendingKsefInvoices();
          setKsefInvoices(invoices);
          setStatus(ProcessingStatus.KSEF_INBOX);
      } catch (e) {
          alert('Błąd połączenia z KSeF');
          setStatus(ProcessingStatus.IDLE);
      }
  };

  const handleApproveKsef = async (invoice: KsefInvoice) => {
      const targetPropertyId = ksefPropertySelections[invoice.id] || selectedPropertyId;
      if (!targetPropertyId) {
          alert("Wybierz nieruchomość.");
          return;
      }

      setProcessingKsefId(invoice.id);
      
      try {
          await uploadInvoiceToCloud({
              ...invoice,
              propertyId: targetPropertyId,
              // KSeF usually provides XML, but we simulate structure data saving. No file bytes for this demo.
          });
          
          // Remove from list
          const remaining = ksefInvoices.filter(i => i.id !== invoice.id);
          setKsefInvoices(remaining);
          setHistory(getRecentInvoices()); // Update dashboard history
          
          // If empty, go back to success/dashboard
          if (remaining.length === 0) {
              setLastUploadLink(null); // No specific link to show, just general success
              setStatus(ProcessingStatus.SUCCESS);
          }
      } catch (e) {
          console.error(e);
          alert("Błąd zapisu.");
      } finally {
          setProcessingKsefId(null);
      }
  };

  const handleKsefPropertyChange = (invoiceId: string, propertyId: string) => {
      setKsefPropertySelections(prev => ({
          ...prev,
          [invoiceId]: propertyId
      }));
  };

  const resetFlow = () => {
    setStatus(ProcessingStatus.IDLE);
    setFileData(null);
    setFileMimeType('');
    setInvoiceData(null);
    setValidationErrors([]);
    // Keep selectedPropertyId as "Last Used"
    setLastUploadLink(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    // Refresh KSeF count on dashboard return
    getPendingKsefInvoices().then(setKsefInvoices);
  };

  const openPropertyManager = (tab: 'list' | 'add') => {
    setPropertyManagerInitialTab(tab);
    setIsPropertyManagerOpen(true);
  };

  // --- STYLE SYSTEM ---
  
  const styles = {
    appContainer: isDarkMode 
      ? "min-h-screen text-gray-100 font-sans relative overflow-x-hidden selection:bg-indigo-500/30"
      : "min-h-screen text-gray-900 font-sans relative overflow-x-hidden selection:bg-indigo-200/50",
    
    // Gradient Blobs Background
    backgroundBlobs: (
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob ${isDarkMode ? 'bg-indigo-900' : 'bg-blue-300'}`}></div>
        <div className={`absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 ${isDarkMode ? 'bg-violet-900' : 'bg-purple-300'}`}></div>
        <div className={`absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 ${isDarkMode ? 'bg-blue-900' : 'bg-indigo-300'}`}></div>
      </div>
    ),

    navbar: isDarkMode
      ? "bg-[#050505]/70 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40 transition-all duration-300 supports-[backdrop-filter]:bg-[#050505]/60"
      : "bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40 transition-all duration-300 supports-[backdrop-filter]:bg-white/60",
    
    // Cards
    card: isDarkMode
      ? "bg-[#1C1C1E]/80 backdrop-blur-md rounded-3xl p-6 border border-white/5 shadow-xl transition-all duration-300 hover:border-white/10"
      : "bg-white/80 backdrop-blur-md rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
      
    // Primary Button (Gradient)
    buttonPrimary: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all duration-300 font-bold text-lg flex items-center justify-center space-x-3 active:scale-95 border border-white/10",
      
    buttonSecondary: isDarkMode
      ? "bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all backdrop-blur-sm"
      : "bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm border border-gray-200/50",

    buttonGhost: isDarkMode
      ? "text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
      : "text-gray-500 hover:text-gray-900 px-4 py-2 text-sm font-medium transition-colors",
      
    // Form Inputs - Apple List Style
    listGroupContainer: isDarkMode
      ? "bg-[#1C1C1E] rounded-2xl overflow-hidden border border-gray-800"
      : "bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm",
      
    listGroupItem: isDarkMode
      ? "flex items-center justify-between p-4 border-b border-gray-800 last:border-0"
      : "flex items-center justify-between p-4 border-b border-gray-100 last:border-0",

    inputTransparent: isDarkMode
      ? "w-full bg-transparent text-right text-white focus:outline-none placeholder-gray-600 font-medium"
      : "w-full bg-transparent text-right text-gray-900 focus:outline-none placeholder-gray-400 font-medium",
      
    label: isDarkMode
      ? "text-gray-400 font-medium text-sm whitespace-nowrap mr-4"
      : "text-gray-500 font-medium text-sm whitespace-nowrap mr-4",
      
    sectionTitle: isDarkMode
      ? "text-2xl font-bold text-white mb-1 tracking-tight"
      : "text-2xl font-bold text-gray-900 mb-1 tracking-tight",
      
    subTitle: isDarkMode
      ? "text-gray-400 text-sm font-medium"
      : "text-gray-500 text-sm font-medium"
  };

  // --- RENDER HELPERS ---

  const renderDashboard = () => {
    const ksefCount = ksefInvoices.length;
    const hasPendingKsef = ksefCount > 0;

    return (
      <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto pb-20">
        
        {/* 1. KSeF Button (Dynamic UI) */}
        <button 
          onClick={handleOpenKsef}
          className="w-full relative overflow-hidden rounded-3xl p-6 shadow-2xl transition-all group hover:scale-[1.01] mb-2 cursor-pointer"
        >
          {/* Intense Gradient Background */}
          <div className={`absolute inset-0 bg-gradient-to-br from-[#8E2DE2] to-[#4A00E0] opacity-100`}></div>
          
          {/* Decorative Background Icon */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-40 h-40 transform rotate-12 -mr-8 -mt-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center text-center text-white">
            
            {/* Status Badge */}
            <div className={`inline-flex items-center space-x-2 backdrop-blur-md px-3 py-1 rounded-full mb-3 border ${hasPendingKsef ? 'bg-white/20 border-white/10' : 'bg-green-500/20 border-green-500/20'}`}>
              <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasPendingKsef ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${hasPendingKsef ? 'bg-orange-500' : 'bg-green-500'}`}></span>
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/90">
                {hasPendingKsef ? 'Wymagane działanie' : 'System gotowy'}
              </span>
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight mb-2">Nowe Faktury z KSeF</h2>
            <p className="text-white/90 text-sm font-medium">
               {hasPendingKsef 
                 ? `Liczba dokumentów do akceptacji: ${ksefCount}` 
                 : 'Wszystkie dokumenty zostały przetworzone'}
            </p>
          </div>
        </button>

        {/* 2. Main Action - Add Cost */}
        <button 
          onClick={() => setStatus(ProcessingStatus.SELECT_METHOD)}
          className={styles.buttonPrimary}
        >
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <span>Dodaj Nowy Koszt</span>
        </button>

        {/* 3. Header Card - Property Database */}
        <button 
          onClick={() => openPropertyManager('list')}
          className={`${styles.card} w-full relative overflow-hidden group flex flex-col items-center justify-center text-center py-8 hover:scale-[1.02] cursor-pointer`}
        >
          {/* Glow effect on hover */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl -mr-16 -mt-16 transition-all duration-500 group-hover:bg-indigo-500/30"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -ml-16 -mb-16 transition-all duration-500 group-hover:bg-blue-500/30"></div>
          
          <div className="relative z-10">
            <h2 className={styles.sectionTitle}>
              Baza Nieruchomości
            </h2>
            <p className={`${styles.subTitle} mt-2`}>
              {properties.filter(p => !p.isArchived).length} {properties.filter(p => !p.isArchived).length === 1 ? 'aktywny adres' : 'aktywnych adresów'}
            </p>
          </div>
        </button>

        {/* Recent Activity */}
        <div className="pt-2">
          <h3 className={`text-xl font-bold mb-4 px-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Ostatnie skany
          </h3>
          
          {history.length === 0 ? (
            <div className={`text-center py-16 rounded-3xl border border-dashed ${isDarkMode ? "bg-white/5 border-white/10 text-gray-500" : "bg-white border-gray-200 text-gray-400"}`}>
              Brak historii skanów.
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 5).map((item) => {
                // Determine link target (Drive or Sheet)
                const targetLink = item.driveLink || "https://docs.google.com/spreadsheets";

                return (
                  <a 
                    key={item.id} 
                    href={targetLink} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.card} !p-4 group hover:scale-[1.02] cursor-pointer flex items-center justify-between block decoration-0`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-3.5 rounded-2xl shadow-sm transition-colors ${isDarkMode ? 'bg-[#2C2C2E] group-hover:bg-[#3A3A3C]' : 'bg-gray-50 group-hover:bg-white'}`}>
                        {item.fileMimeType === 'application/pdf' ? (
                          <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                        ) : item.fileMimeType ? (
                          <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                        ) : (
                          // Manual Entry Icon (Document with pencil or similar)
                          <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.sellerName || 'Nieznany sprzedawca'}</p>
                        <p className={`text-xs mt-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {item.date} • <span className={isDarkMode ? "text-indigo-400" : "text-indigo-600"}>{item.grossAmount.toFixed(2)} {item.currency}</span>
                        </p>
                        <p className={`text-xs mt-1 sm:hidden font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {properties.find(p => p.id === item.propertyId)?.address || 'Nieznany adres'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block pl-4 max-w-[40%] truncate">
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {properties.find(p => p.id === item.propertyId)?.address || 'Nieznany adres'}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMethodSelection = () => (
    <div className="flex flex-col animate-fade-in-up max-w-2xl mx-auto pb-10">
       <button 
         onClick={() => setStatus(ProcessingStatus.IDLE)}
         className={`self-start mb-8 flex items-center group ${styles.buttonGhost}`}
       >
          <div className={`p-1 rounded-full mr-2 transition-colors ${isDarkMode ? 'bg-gray-800 group-hover:bg-gray-700' : 'bg-gray-200 group-hover:bg-gray-300'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </div>
          Wróć
       </button>

       <div className="flex-1 flex flex-col items-center justify-center space-y-10">
         <div className="text-center space-y-2 mb-4">
           <h2 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Dodaj Nowy Koszt
           </h2>
           <p className={styles.subTitle}>
              Wybierz metodę importu dokumentu
           </p>
         </div>

        <div className="w-full grid gap-6">
          {/* CAMERA OPTION */}
          <label className={`${styles.card} flex items-center cursor-pointer group relative overflow-hidden !p-8 hover:scale-[1.02] active:scale-95 transition-transform duration-300`}>
            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 bg-gradient-to-br from-blue-500 to-indigo-600`}>
               {/* Corrected Camera Icon */}
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
               </svg>
            </div>
            <div className="ml-6">
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Zrób zdjęcie
              </span>
              <span className={`${styles.subTitle} mt-1 block`}>
                  Użyj aparatu w telefonie
              </span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileSelect} 
              className="hidden" 
              ref={fileInputRef}
            />
          </label>
          
          {/* UPLOAD OPTION */}
          <label className={`${styles.card} flex items-center cursor-pointer group relative overflow-hidden !p-8 hover:scale-[1.02] active:scale-95 transition-transform duration-300`}>
             <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
             
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 bg-gradient-to-br from-violet-500 to-fuchsia-600`}>
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
             <div className="ml-6">
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                 Wgraj plik
              </span>
              <span className={`${styles.subTitle} mt-1 block`}>PDF, JPG, PNG</span>
            </div>
            <input 
              type="file" 
              accept="image/*,application/pdf"
              onChange={handleFileSelect} 
              className="hidden" 
            />
          </label>

           {/* MANUAL ENTRY OPTION - NEW */}
          <button 
             onClick={handleManualEntry}
             className={`${styles.card} flex items-center cursor-pointer group relative overflow-hidden !p-8 hover:scale-[1.02] active:scale-95 transition-transform duration-300 text-left w-full`}
          >
             <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
             
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br from-amber-500 to-orange-600`}>
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
             <div className="ml-6">
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                 Koszt bez dokumentu
              </span>
              <span className={`${styles.subTitle} mt-1 block`}>Tylko kwota i sprzedawca</span>
            </div>
          </button>
        </div>
       </div>
    </div>
  );

  const renderReview = () => {
    if (!invoiceData) return null;
    const activeProperties = properties.filter(p => !p.isArchived);
    const isPdf = fileMimeType === 'application/pdf';
    
    // Check if it's manual mode (no file data present)
    const isManualMode = !fileData;

    return (
      <div className={`w-full max-w-2xl mx-auto animate-fade-in-up pb-20`}>
        
        {/* Document Preview Header (Only show if not manual mode) */}
        {!isManualMode && (
            <div className={`relative h-64 rounded-3xl overflow-hidden mb-8 shadow-2xl ${isDarkMode ? 'bg-[#1C1C1E]' : 'bg-white'}`}>
                {fileData && !isPdf && (
                <img src={fileData} alt="Faktura" className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105" />
                )}
                
                {isPdf && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <svg className="w-24 h-24 text-gray-400 mb-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    <span className="text-gray-400 font-medium">Dokument PDF</span>
                </div>
                )}
                
                <div className={`absolute inset-0 bg-gradient-to-t ${isDarkMode ? 'from-[#050505] via-[#050505]/40' : 'from-[#F2F2F7] via-[#F2F2F7]/40'} to-transparent`}></div>

                <div className="absolute bottom-0 left-0 p-8 w-full">
                <div className="flex justify-between items-end">
                    <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Weryfikacja
                    </h2>
                    <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-md ${isDarkMode ? 'bg-white/20 text-white' : 'bg-black/10 text-black'}`}>
                    AI Analysis
                    </span>
                </div>
                </div>
            </div>
        )}

        {/* Manual Mode Header */}
        {isManualMode && (
             <div className="mb-8 px-2 text-center">
                <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Weryfikacja
                </h2>
                <p className={styles.subTitle}>Wprowadź dane ręcznie</p>
             </div>
        )}

        <div className="space-y-8">
          
          {/* Section 1: Property */}
          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Przypisanie</h4>
              <button 
                onClick={() => openPropertyManager('add')}
                className="text-xs font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wide transition-colors"
              >
                + Nowy Adres
              </button>
            </div>
            <div className={styles.listGroupContainer}>
               <div className="relative p-1">
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className={`w-full p-4 rounded-xl appearance-none outline-none font-medium transition-colors cursor-pointer ${
                    isDarkMode ? 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <option value="">-- Wybierz adres nieruchomości --</option>
                  {activeProperties.map(p => (
                    <option key={p.id} value={p.id}>{p.address}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                </div>
               </div>
            </div>
          </div>

          {/* Section 2: Details */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 px-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Szczegóły Faktury</h4>
            <div className={styles.listGroupContainer}>
              <div className={styles.listGroupItem}>
                <label className={styles.label}>Sprzedawca</label>
                <input 
                  type="text" 
                  value={invoiceData.sellerName}
                  onChange={e => setInvoiceData({...invoiceData, sellerName: e.target.value})}
                  className={styles.inputTransparent}
                  placeholder={isManualMode ? "Wpisz nazwę sprzedawcy" : ""}
                />
              </div>
              <div className={styles.listGroupItem}>
                <label className={styles.label}>{isManualMode ? 'Opis' : 'Numer'}</label>
                <input 
                  type="text" 
                  value={invoiceData.invoiceNumber}
                  onChange={e => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                  className={styles.inputTransparent}
                  placeholder={isManualMode ? "Opcjonalnie" : ""}
                />
              </div>
              <div className={styles.listGroupItem}>
                <label className={styles.label}>Data</label>
                <input 
                  type="date" 
                  value={invoiceData.date}
                  onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}
                  className={`${styles.inputTransparent} ${isDarkMode ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financials */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 px-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Kwoty</h4>
            <div className={styles.listGroupContainer}>
               
               {/* Only show Net/Vat if NOT manual mode */}
               {!isManualMode && (
                   <>
                    <div className={styles.listGroupItem}>
                        <label className={styles.label}>Netto</label>
                        <div className="flex items-center justify-end w-full space-x-2">
                        <input 
                            type="number" 
                            step="0.01"
                            value={invoiceData.netAmount}
                            onChange={e => setInvoiceData({...invoiceData, netAmount: parseFloat(e.target.value) || 0})}
                            className={`${styles.inputTransparent} w-32`}
                        />
                        <span className={`text-sm font-medium ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{invoiceData.currency || 'PLN'}</span>
                        </div>
                    </div>
                    <div className={styles.listGroupItem}>
                        <label className={styles.label}>VAT</label>
                        <div className="flex items-center justify-end w-full space-x-2">
                        <input 
                            type="number" 
                            step="0.01"
                            value={invoiceData.vatAmount}
                            onChange={e => setInvoiceData({...invoiceData, vatAmount: parseFloat(e.target.value) || 0})}
                            className={`${styles.inputTransparent} w-32`}
                        />
                        <span className={`text-sm font-medium ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>{invoiceData.currency || 'PLN'}</span>
                        </div>
                    </div>
                   </>
               )}

              {/* Gross Amount Highlight */}
              <div className={`flex items-center justify-between p-6 ${isDarkMode ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                <label className={`font-bold uppercase tracking-wide ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                   {isManualMode ? 'Kwota' : 'Brutto'}
                </label>
                <div className="flex items-center space-x-2">
                   <input 
                     type="number" 
                     step="0.01"
                     value={invoiceData.grossAmount}
                     onChange={e => setInvoiceData({...invoiceData, grossAmount: parseFloat(e.target.value) || 0})}
                     className={`w-32 bg-transparent text-right text-3xl font-bold outline-none ${isDarkMode ? 'text-white' : 'text-blue-900'}`}
                   />
                   <span className={`text-lg font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}>
                     {invoiceData.currency || 'PLN'}
                   </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className={`mb-6 p-4 rounded-xl border animate-fade-in-up ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-red-50 border-red-200 text-red-600'}`}>
                <div className="flex items-center space-x-2 mb-2 font-bold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>Uzupełnij wymagane dane:</span>
                </div>
                <ul className="list-disc list-inside text-sm space-y-1 ml-1 opacity-90">
                    {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                    ))}
                </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 pt-6">
             <button 
               onClick={resetFlow} 
               className={`flex-1 py-4 px-6 font-bold rounded-2xl transition-all duration-300 ${isDarkMode ? 'bg-[#2C2C2E] text-gray-400 hover:bg-[#3A3A3C] hover:text-white' : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 shadow-sm'}`}
             >
               Anuluj
             </button>
             <button 
               onClick={handleSubmit} 
               className={`flex-1 py-4 px-6 rounded-2xl font-bold shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-blue-500/50`}
             >
               Zatwierdź
             </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSuccess = () => (
    <div className={`flex flex-col items-center justify-center p-12 max-w-md mx-auto text-center space-y-8 animate-fade-in-up ${styles.card}`}>
      <div className={`relative w-32 h-32 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-green-500/10' : 'bg-green-100'}`}>
         <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isDarkMode ? 'bg-green-500' : 'bg-green-400'}`}></div>
         <svg className={`w-16 h-16 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
      </div>
      <div>
        <h2 className={`text-4xl font-bold tracking-tight mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Gotowe!
        </h2>
        <p className={`${styles.subTitle} text-base leading-relaxed mb-6`}>
          {lastUploadLink 
            ? 'Faktura została przeanalizowana i zapisana. Dane są w Arkuszu, a plik na Dysku Google.'
            : 'Dane kosztu zostały zapisane w Arkuszu (bez pliku).'
          }
        </p>
        
        {lastUploadLink && (
           <a 
             href={lastUploadLink} 
             target="_blank" 
             rel="noopener noreferrer"
             className={`inline-flex items-center px-6 py-3 rounded-full text-sm font-bold transition-all transform hover:-translate-y-0.5 ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
           >
             <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
             Zobacz na Dysku Google
           </a>
        )}
      </div>
      <button 
        onClick={resetFlow}
        className={styles.buttonPrimary}
      >
        Wróć do pulpitu
      </button>
    </div>
  );

  const renderKsefInbox = () => {
    const activeProperties = properties.filter(p => !p.isArchived);

    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in-up pb-20">
        <div className="flex items-center justify-between mb-8">
           <button 
             onClick={() => setStatus(ProcessingStatus.IDLE)}
             className={`flex items-center group ${styles.buttonGhost}`}
           >
              <div className={`p-1 rounded-full mr-2 transition-colors ${isDarkMode ? 'bg-gray-800 group-hover:bg-gray-700' : 'bg-gray-200 group-hover:bg-gray-300'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </div>
              Wróć do pulpitu
           </button>
           <h2 className={`text-2xl font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Skrzynka KSeF
           </h2>
        </div>

        {ksefInvoices.length === 0 ? (
           <div className={`text-center py-20 rounded-3xl border border-dashed ${isDarkMode ? "bg-white/5 border-white/10 text-gray-500" : "bg-white border-gray-200 text-gray-400"}`}>
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-lg font-medium">Wszystkie faktury zostały przetworzone.</p>
           </div>
        ) : (
           <div className="grid gap-6">
              {ksefInvoices.map(invoice => {
                 const isProcessing = processingKsefId === invoice.id;
                 const currentPropId = ksefPropertySelections[invoice.id] || selectedPropertyId || '';

                 return (
                    <div key={invoice.id} className={`${styles.card} relative overflow-hidden transition-all duration-300`}>
                       <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                          
                          {/* Invoice Info */}
                          <div className="flex-1">
                             <div className="flex items-center space-x-3 mb-2">
                                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md ${isDarkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                                   Faktura VAT
                                </span>
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                   {invoice.date}
                                </span>
                             </div>
                             <h3 className={`text-xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {invoice.sellerName}
                             </h3>
                             <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                Nr: {invoice.invoiceNumber}
                             </p>
                             
                             <div className="mt-4 flex flex-wrap gap-4 text-sm">
                                <div>
                                   <span className={`block text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Netto</span>
                                   <span className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{invoice.netAmount.toFixed(2)}</span>
                                </div>
                                <div>
                                   <span className={`block text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>VAT</span>
                                   <span className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{invoice.vatAmount.toFixed(2)}</span>
                                </div>
                                <div>
                                   <span className={`block text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Brutto</span>
                                   <span className={`font-bold text-lg ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{invoice.grossAmount.toFixed(2)} {invoice.currency}</span>
                                </div>
                             </div>
                          </div>

                          {/* Action Area */}
                          <div className="w-full md:w-80 flex flex-col gap-4 bg-opacity-50 rounded-xl p-1">
                             <div>
                                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                   Przypisz do nieruchomości
                                </label>
                                <div className="relative">
                                    <select
                                       value={currentPropId}
                                       onChange={(e) => handleKsefPropertyChange(invoice.id, e.target.value)}
                                       disabled={isProcessing}
                                       className={`w-full p-3 pr-10 rounded-xl appearance-none outline-none font-medium transition-colors cursor-pointer border ${
                                          isDarkMode 
                                             ? 'bg-[#2C2C2E] border-gray-700 text-white hover:border-gray-600' 
                                             : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300 shadow-sm'
                                       }`}
                                    >
                                       <option value="" disabled>Wybierz adres...</option>
                                       {activeProperties.map(p => (
                                          <option key={p.id} value={p.id}>{p.address}</option>
                                       ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                       <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                             </div>

                             <button
                                onClick={() => handleApproveKsef(invoice)}
                                disabled={isProcessing || !currentPropId}
                                className={`w-full py-3 px-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center space-x-2 ${
                                   !currentPropId 
                                      ? (isDarkMode ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                                      : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-green-500/30 hover:scale-[1.02] active:scale-95'
                                }`}
                             >
                                {isProcessing ? (
                                   <>
                                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      <span>Zapisywanie...</span>
                                   </>
                                ) : (
                                   <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                      <span>Zatwierdź</span>
                                   </>
                                )}
                             </button>
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        )}
      </div>
    );
  };

  // Loading State
  if (isAuthLoading) {
    return (
      <div className={styles.appContainer}>
         {styles.backgroundBlobs}
         <div className="flex items-center justify-center min-h-screen">
             <Spinner isDarkMode={isDarkMode} />
         </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!currentUser) {
      return (
          <div className={styles.appContainer}>
             {styles.backgroundBlobs}
              {/* Theme Toggle Button for Login Screen */}
             <div className="absolute top-6 right-6 z-50">
                <button onClick={toggleTheme} className={`p-2.5 rounded-full transition-all duration-300 group ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm'}`}>
                    {isDarkMode ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    )}
                </button>
             </div>
             <Login onLoginSuccess={handleLoginSuccess} isDarkMode={isDarkMode} />
          </div>
      )
  }

  // MAIN APP
  return (
    <div className={styles.appContainer}>
      {styles.backgroundBlobs}
      
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div 
             className="flex items-center space-x-4 cursor-pointer group" 
             onClick={resetFlow}
          >
            {/* LOGO */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg overflow-hidden shrink-0 transition-transform duration-500 bg-white border border-gray-100`}>
               <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                  <defs>
                    <linearGradient id="logoGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <path d="M10 10H14M10 10V14M30 10H26M30 10V14M10 30H14M10 30V26M30 30H26M30 30V26" stroke="url(#logoGradient)" strokeWidth="3" strokeLinecap="round" />
                  <path d="M15 26V20C15 19.4477 15.4477 19 16 19H19V26M21 26V15C21 14.4477 21.4477 14 22 14H25V26" fill="url(#logoGradient)" fillOpacity="0.8" />
               </svg>
            </div>
            
            <div className="flex flex-col">
              <h1 className={`text-xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r ${isDarkMode ? 'from-white to-gray-400' : 'from-gray-900 to-gray-600'}`}>
                RECOST AI
              </h1>
              <span className={`text-[10px] font-bold tracking-widest uppercase mt-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                Real Estate Cost Tracker
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
             {status !== ProcessingStatus.IDLE && status !== ProcessingStatus.SELECT_METHOD && (
                <button onClick={resetFlow} className={styles.buttonGhost}>
                  Anuluj
                </button>
             )}
             
             {/* Settings Button */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-2.5 rounded-full transition-all duration-300 group ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm'}`}
             >
                <svg className="w-5 h-5 transition-transform duration-700 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>

             {/* Theme Toggle Button */}
             <button onClick={toggleTheme} className={`p-2.5 rounded-full transition-all duration-300 group ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm'}`} title="Zmień motyw">
               {isDarkMode ? (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                 </svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                 </svg>
               )}
             </button>

             {/* Logout Button */}
             <button onClick={handleLogout} className={`p-2.5 rounded-full transition-all duration-300 group ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-500' : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 shadow-sm'}`} title="Wyloguj">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        {status === ProcessingStatus.IDLE && renderDashboard()}
        {status === ProcessingStatus.SELECT_METHOD && renderMethodSelection()}
        {status === ProcessingStatus.ANALYZING && <Spinner label="Przetwarzanie AI..." isDarkMode={isDarkMode} />}
        {status === ProcessingStatus.REVIEW && renderReview()}
        {status === ProcessingStatus.UPLOADING && <Spinner label="Synchronizacja z Chmurą..." isDarkMode={isDarkMode} />}
        {status === ProcessingStatus.SUCCESS && renderSuccess()}
        {status === ProcessingStatus.KSEF_INBOX && renderKsefInbox()}
      </main>

      {/* Modals */}
      {isPropertyManagerOpen && (
        <PropertyManager 
          properties={properties} 
          onSave={handlePropertySave} 
          onClose={() => setIsPropertyManagerOpen(false)} 
          isDarkMode={isDarkMode}
          initialTab={propertyManagerInitialTab}
        />
      )}

      {isSettingsOpen && currentUser && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
          isDarkMode={isDarkMode}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default App;