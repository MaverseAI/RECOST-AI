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
    document.body.style.backgroundColor = isDarkMode ? '#0f172a' : '#F5F5F7'; 
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
      ? "min-h-screen text-slate-50 font-sans relative overflow-x-hidden selection:bg-[#5e13f6]/30"
      : "min-h-screen text-[#1d1d1f] font-sans relative overflow-x-hidden selection:bg-[#5e13f6]/20",
    
    // Gradient Blobs Background
    backgroundBlobs: (
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob bg-purple-600`}></div>
        <div className={`absolute top-[20%] right-[-10%] w-[400px] h-[400px] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-2000 bg-blue-600`}></div>
        <div className={`absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-4000 bg-indigo-600`}></div>
      </div>
    ),

    navbar: isDarkMode
      ? "bg-slate-900/70 backdrop-blur-[20px] border-b border-white/10 sticky top-0 z-40 transition-all duration-300"
      : "bg-[#F5F5F7]/70 backdrop-blur-[20px] border-b border-white/50 sticky top-0 z-40 transition-all duration-300",
    
    // Cards (Glassmorphism)
    card: isDarkMode
      ? "bg-slate-800/70 backdrop-blur-[20px] rounded-3xl p-6 border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all duration-300"
      : "bg-white/85 backdrop-blur-[20px] rounded-3xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.05)] border border-white/50 transition-all duration-300",
      
    // Selection Tile (for hover effects)
    selectionTile: (isActive: boolean) => isDarkMode 
        ? `rounded-3xl p-8 border transition-all duration-300 ${isActive ? 'bg-[#5e13f6]/5 border-[#5e13f6] shadow-[0_0_20px_rgba(94,19,246,0.1)]' : 'bg-slate-800 border-slate-700 hover:scale-[1.03] hover:-translate-y-0.5'}`
        : `rounded-3xl p-8 transition-all duration-300 ${isActive ? 'bg-[#5e13f6]/5 border-2 border-[#5e13f6] shadow-[0_0_20px_rgba(94,19,246,0.1)]' : 'bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:scale-[1.03] hover:-translate-y-0.5 border border-transparent'}`,

    // Primary Button (Gradient)
    buttonPrimary: "w-full bg-gradient-to-r from-[#5e13f6] to-[#8b5cf6] text-white p-5 rounded-2xl shadow-lg shadow-[#5e13f6]/20 hover:shadow-[#5e13f6]/40 hover:scale-[1.02] transition-all duration-300 font-bold text-lg flex items-center justify-center space-x-3 active:scale-95 border border-white/10",
      
    buttonSecondary: isDarkMode
      ? "bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all backdrop-blur-sm"
      : "bg-gray-100 hover:bg-gray-200 text-[#1d1d1f] px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm border border-gray-200/50",

    buttonGhost: isDarkMode
      ? "text-slate-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
      : "text-[#86868b] hover:text-[#1d1d1f] px-4 py-2 text-sm font-medium transition-colors",
      
    // Form Inputs - Apple List Style
    listGroupContainer: isDarkMode
      ? "bg-slate-800 rounded-2xl overflow-hidden border border-slate-700"
      : "bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm",
      
    listGroupItem: isDarkMode
      ? "flex items-center justify-between p-4 border-b border-slate-700 last:border-0"
      : "flex items-center justify-between p-4 border-b border-gray-100 last:border-0",

    inputTransparent: isDarkMode
      ? "w-full bg-transparent text-right text-slate-50 focus:outline-none placeholder-slate-500 font-medium"
      : "w-full bg-transparent text-right text-[#1d1d1f] focus:outline-none placeholder-gray-400 font-medium",
      
    label: isDarkMode
      ? "text-slate-400 font-medium text-sm whitespace-nowrap mr-4"
      : "text-[#86868b] font-medium text-sm whitespace-nowrap mr-4",
      
    sectionTitle: isDarkMode
      ? "text-2xl font-bold text-slate-50 mb-1 tracking-tight"
      : "text-2xl font-bold text-[#1d1d1f] mb-1 tracking-tight",
      
    subTitle: isDarkMode
      ? "text-slate-400 text-sm font-medium"
      : "text-[#86868b] text-sm font-medium"
  };

  // --- RENDER HELPERS ---

  const renderDashboard = () => {
    const ksefCount = ksefInvoices.length;
    const hasPendingKsef = ksefCount > 0;
    const activePropertiesCount = properties.filter(p => !p.isArchived).length;

    return (
      <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto pb-20">
        
        {/* 1. KSeF Button - Blue Gradient */}
        <button 
          onClick={handleOpenKsef}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-5 rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all duration-300 font-bold text-lg flex items-center justify-center space-x-3 active:scale-95 border border-white/10"
        >
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <span>Nowe Faktury z KSeF {hasPendingKsef ? `(${ksefCount})` : ''}</span>
        </button>

        {/* 2. Main Action - Add Cost - Indigo/Purple Gradient (Existing Primary) */}
        <button 
          onClick={() => setStatus(ProcessingStatus.SELECT_METHOD)}
          className={styles.buttonPrimary}
        >
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <span>Dodaj Nowy Koszt</span>
        </button>

        {/* 3. Property Database - Deep Purple Gradient */}
        <button 
          onClick={() => openPropertyManager('list')}
          className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white p-5 rounded-2xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.02] transition-all duration-300 font-bold text-lg flex items-center justify-center space-x-3 active:scale-95 border border-white/10"
        >
          <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <span>Baza Nieruchomości ({activePropertiesCount})</span>
        </button>

        {/* Recent Activity */}
        <div className="pt-2">
          <h3 className={`text-xl font-bold mb-4 px-2 tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
            Ostatnie skany
          </h3>
          
          {history.length === 0 ? (
            <div className={`text-center py-16 rounded-3xl border border-dashed ${isDarkMode ? "bg-white/5 border-white/10 text-slate-500" : "bg-white border-gray-200 text-[#86868b]"}`}>
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
                          <svg className="w-6 h-6 text-[#5e13f6]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                        ) : (
                          // Manual Entry Icon (Document with pencil or similar)
                          <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-base ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>{item.sellerName || 'Nieznany sprzedawca'}</p>
                        <p className={`text-xs mt-1 font-medium ${isDarkMode ? 'text-slate-400' : 'text-[#86868b]'}`}>
                          {item.date} • <span className={isDarkMode ? "text-indigo-400" : "text-[#5e13f6]"}>{item.grossAmount.toFixed(2)} {item.currency}</span>
                        </p>
                        <p className={`text-xs mt-1 sm:hidden font-medium ${isDarkMode ? 'text-slate-500' : 'text-[#86868b]'}`}>
                          {properties.find(p => p.id === item.propertyId)?.address || 'Nieznany adres'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block pl-4 max-w-[40%] truncate">
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-[#86868b]'}`}>
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
          <div className={`p-1 rounded-full mr-2 transition-colors ${isDarkMode ? 'bg-slate-800 group-hover:bg-slate-700' : 'bg-white group-hover:bg-gray-100'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </div>
          Wróć
       </button>

       <div className="flex-1 flex flex-col items-center justify-center space-y-10">
         <div className="text-center space-y-2 mb-4">
           <h2 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
              Dodaj Nowy Koszt
           </h2>
           <p className={styles.subTitle}>
              Wybierz metodę importu dokumentu
           </p>
         </div>

        <div className="w-full grid gap-6">
          {/* CAMERA OPTION */}
          <label className={`${styles.selectionTile(false)} flex items-center cursor-pointer group relative overflow-hidden`}>
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
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
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
          <label className={`${styles.selectionTile(false)} flex items-center cursor-pointer group relative overflow-hidden`}>
             <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
             
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 bg-gradient-to-br from-violet-500 to-fuchsia-600`}>
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
             <div className="ml-6">
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
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
             className={`${styles.selectionTile(false)} flex items-center cursor-pointer group relative overflow-hidden text-left w-full`}
          >
             <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
             
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br from-amber-500 to-orange-600`}>
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </div>
             <div className="ml-6">
              <span className={`block text-xl font-bold ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
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
          <>
            <div className="flex justify-between items-end mb-4 px-4">
              <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
                Weryfikacja
              </h2>
              <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-md ${isDarkMode ? 'bg-white/10 text-slate-300' : 'bg-black/5 text-[#1d1d1f]'}`}>
                AI Analysis
              </span>
            </div>

            <div className={`relative w-full rounded-3xl overflow-hidden mb-8 shadow-2xl border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-white/50'}`}>
                {fileData && !isPdf && (
                  <img src={fileData} alt="Faktura" className="w-full h-auto block opacity-90" />
                )}
                
                {isPdf && (
                <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-br from-slate-800 to-slate-900">
                    <svg className="w-24 h-24 text-slate-400 mb-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    <span className="text-slate-400 font-medium">Dokument PDF</span>
                </div>
                )}
            </div>
          </>
        )}

        {/* Manual Mode Header */}
        {isManualMode && (
             <div className="mb-8 px-2 text-center">
                <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
                  Weryfikacja
                </h2>
                <p className={styles.subTitle}>Wprowadź dane ręcznie</p>
             </div>
        )}

        <div className="space-y-8">
          
          {/* Section 1: Property */}
          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <h4 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-[#86868b]'}`}>Przypisanie</h4>
              <button 
                onClick={() => openPropertyManager('add')}
                className="text-xs font-bold text-[#5e13f6] hover:text-[#8b5cf6] uppercase tracking-wide transition-colors"
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
                    isDarkMode ? 'bg-slate-800 text-slate-50 hover:bg-slate-700' : 'bg-white text-[#1d1d1f] hover:bg-gray-50'
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
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 px-2 ${isDarkMode ? 'text-slate-500' : 'text-[#86868b]'}`}>Szczegóły Faktury</h4>
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
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 px-2 ${isDarkMode ? 'text-slate-500' : 'text-[#86868b]'}`}>Kwoty</h4>
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
                        <span className={`text-sm font-medium ${isDarkMode ? "text-slate-500" : "text-[#86868b]"}`}>{invoiceData.currency || 'PLN'}</span>
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
                        <span className={`text-sm font-medium ${isDarkMode ? "text-slate-500" : "text-[#86868b]"}`}>{invoiceData.currency || 'PLN'}</span>
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
               className={`flex-1 py-4 px-6 font-bold rounded-2xl transition-all duration-300 ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white' : 'bg-white text-[#86868b] hover:bg-gray-50 hover:text-[#1d1d1f] shadow-sm'}`}
             >
               Anuluj
             </button>
             <button 
               onClick={handleSubmit} 
               className={`flex-1 py-4 px-6 rounded-2xl font-bold shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 bg-gradient-to-r from-[#5e13f6] to-[#8b5cf6] text-white shadow-[#5e13f6]/30 hover:shadow-[#5e13f6]/50`}
             >
               Zatwierdź
             </button>
          </div>
        </div>
      </div>
    );
  };

  if (isAuthLoading) {
    return (
      <div className={styles.appContainer + " flex items-center justify-center"}>
        {styles.backgroundBlobs}
        <Spinner label="Ładowanie..." isDarkMode={isDarkMode} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={styles.appContainer + " flex items-center justify-center"}>
        {styles.backgroundBlobs}
        <Login onLoginSuccess={handleLoginSuccess} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className={styles.appContainer}>
      {styles.backgroundBlobs}
      
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
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
                <h1 className={`text-xl font-extrabold tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-[#1d1d1f]'}`}>
                  RECOST AI
                </h1>
                <span className={`text-[10px] font-bold tracking-widest uppercase mt-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-[#5e13f6]'}`}>
                  Real Estate Cost Tracker
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
               <button 
                 onClick={toggleTheme}
                 className={`p-2.5 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-white/10 text-yellow-300 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
               >
                 {isDarkMode ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                 ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                 )}
               </button>
               
               <div 
                 className={`w-10 h-10 rounded-full bg-gradient-to-br from-[#5e13f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-transform`}
                 onClick={() => setIsSettingsOpen(true)}
               >
                 {currentUser.email.charAt(0).toUpperCase()}
               </div>

               <button 
                 onClick={handleLogout}
                 className={`p-2.5 rounded-full transition-all duration-300 group ml-2 ${isDarkMode ? 'bg-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-500' : 'bg-gray-100 text-[#86868b] hover:bg-red-50 hover:text-red-600 shadow-sm'}`}
                 title="Wyloguj"
               >
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* KSeF Inbox View */}
        {status === ProcessingStatus.KSEF_INBOX && (
           <div className="animate-fade-in-up max-w-4xl mx-auto pb-20">
               <div className="flex items-center justify-between mb-8">
                  <h2 className={`text-3xl font-bold tracking-tight ${isDarkMode ? 'text-slate-50' : 'text-[#1d1d1f]'}`}>
                     Skrzynka Odbiorcza KSeF
                  </h2>
                  <button onClick={() => setStatus(ProcessingStatus.IDLE)} className={styles.buttonGhost}>
                    Zamknij
                  </button>
               </div>
               
               {ksefInvoices.length === 0 ? (
                  <div className={`text-center py-20 rounded-3xl ${isDarkMode ? "bg-slate-800/50 text-slate-500" : "bg-gray-50 text-gray-500"}`}>
                     Wszystkie faktury zostały przetworzone.
                  </div>
               ) : (
                 <div className="space-y-6">
                    {ksefInvoices.map((inv) => (
                       <div key={inv.id} className={`${styles.card} group hover:shadow-xl hover:-translate-y-1`}>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                             
                             {/* Data */}
                             <div className="flex-1 space-y-1">
                                <div className="flex items-center space-x-2">
                                   <span className="text-xs font-bold uppercase tracking-wider text-[#5e13f6] bg-[#5e13f6]/10 px-2 py-0.5 rounded">KSeF</span>
                                   <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>{inv.invoiceNumber}</span>
                                </div>
                                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{inv.sellerName}</h3>
                                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>{inv.date}</p>
                             </div>

                             {/* Amount */}
                             <div className="text-right">
                                <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                   {inv.grossAmount.toFixed(2)} <span className="text-sm font-medium text-gray-400">{inv.currency}</span>
                                </div>
                                <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>brutto</div>
                             </div>

                             {/* Action */}
                             <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                <select 
                                   className={`w-full sm:w-48 p-2.5 rounded-xl text-sm font-medium border-r-8 border-transparent outline-none cursor-pointer transition-all ${isDarkMode ? 'bg-slate-900 text-white hover:bg-black/40' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                   value={ksefPropertySelections[inv.id] || selectedPropertyId}
                                   onChange={(e) => handleKsefPropertyChange(inv.id, e.target.value)}
                                >
                                   <option value="" disabled>Wybierz nieruchomość</option>
                                   {properties.filter(p => !p.isArchived).map(p => (
                                      <option key={p.id} value={p.id}>{p.address}</option>
                                   ))}
                                </select>
                                
                                <button 
                                  onClick={() => handleApproveKsef(inv)}
                                  disabled={processingKsefId === inv.id}
                                  className="w-full sm:w-auto bg-[#5e13f6] hover:bg-[#4c0cd0] text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                                >
                                   {processingKsefId === inv.id ? 'Zapisywanie...' : 'Zaksięguj'}
                                </button>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
           </div>
        )}

        {/* Dashboard View */}
        {status === ProcessingStatus.IDLE && renderDashboard()}

        {/* Method Selection View */}
        {status === ProcessingStatus.SELECT_METHOD && renderMethodSelection()}

        {/* Processing/Loading States */}
        {status === ProcessingStatus.ANALYZING && (
          <Spinner label="Analiza AI w toku..." isDarkMode={isDarkMode} />
        )}
        
        {status === ProcessingStatus.UPLOADING && (
          <Spinner label="Wysyłanie do chmury..." isDarkMode={isDarkMode} />
        )}

        {/* Review View */}
        {status === ProcessingStatus.REVIEW && renderReview()}

        {/* Success View */}
        {status === ProcessingStatus.SUCCESS && (
          <div className="flex flex-col items-center justify-center py-20 animate-scale-in">
             <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 mb-6">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
             </div>
             <h2 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-[#1d1d1f]'}`}>Gotowe!</h2>
             <p className={`text-center max-w-md mb-8 ${isDarkMode ? 'text-slate-400' : 'text-[#86868b]'}`}>
                {lastUploadLink 
                   ? "Faktura została przetworzona i zapisana na Dysku Google oraz w Arkuszu."
                   : "Dane zostały pomyślnie zapisane."}
             </p>
             
             <div className="flex flex-col space-y-3 w-full max-w-xs">
                {lastUploadLink && (
                  <a 
                    href={lastUploadLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-center transition-colors shadow-lg shadow-blue-600/20"
                  >
                    Otwórz folder
                  </a>
                )}
                <button 
                  onClick={resetFlow}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition-colors"
                >
                  Wróć do startu
                </button>
             </div>
          </div>
        )}

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
           currentUser={currentUser}
           isDarkMode={isDarkMode}
           onClose={() => setIsSettingsOpen(false)}
        />
      )}

    </div>
  );
};

export default App;