import React, { useState, useEffect, useRef } from 'react';
import { 
  Property, 
  ProcessingStatus, 
  ExtractedInvoiceData, 
  InvoiceRecord,
  User 
} from './types';
import { extractInvoiceData } from './services/geminiService';
import { getProperties, saveProperty, uploadInvoiceToCloud, getRecentInvoices } from './services/cloudService';
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
    try {
      const base64Content = base64Full.split(',')[1];
      const result = await extractInvoiceData(base64Content, mimeType);
      
      setInvoiceData(result);
      setStatus(ProcessingStatus.REVIEW);
    } catch (error) {
      console.error(error);
      alert("Błąd analizy danych.");
      setStatus(ProcessingStatus.SELECT_METHOD);
    }
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
    if (!invoiceData || !selectedPropertyId || !fileData) {
      alert("Brakujące dane.");
      return;
    }

    setStatus(ProcessingStatus.UPLOADING);
    try {
      const base64Content = fileData.split(',')[1];
      const result = await uploadInvoiceToCloud({
        ...invoiceData,
        propertyId: selectedPropertyId,
        fileData: base64Content,
        mimeType: fileMimeType
      });
      
      setLastUploadLink(result.driveLink);
      setHistory(getRecentInvoices());
      setStatus(ProcessingStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      alert("Błąd chmury.");
      setStatus(ProcessingStatus.REVIEW);
    }
  };

  const resetFlow = () => {
    setStatus(ProcessingStatus.IDLE);
    setFileData(null);
    setFileMimeType('');
    setInvoiceData(null);
    setSelectedPropertyId('');
    setLastUploadLink(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const renderDashboard = () => (
    <div className="space-y-8 animate-fade-in-up max-w-2xl mx-auto pb-20">
      {/* Header Card - Clickable Property Database */}
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

      {/* Main Action */}
      <button 
        onClick={() => setStatus(ProcessingStatus.SELECT_METHOD)}
        className={styles.buttonPrimary}
      >
        <div className="bg-white/20 p-2.5 rounded-full backdrop-blur-sm">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
        </div>
        <span>Dodaj Nowy Koszt</span>
      </button>

      {/* Recent Activity */}
      <div>
        <h3 className={`text-xl font-bold mb-4 px-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Ostatnie skany
        </h3>
        
        {history.length === 0 ? (
          <div className={`text-center py-16 rounded-3xl border border-dashed ${isDarkMode ? "bg-white/5 border-white/10 text-gray-500" : "bg-white border-gray-200 text-gray-400"}`}>
            Brak historii skanów.
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((item) => (
              <a 
                key={item.id} 
                href={item.driveLink || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${styles.card} !p-4 group hover:scale-[1.02] cursor-pointer flex items-center justify-between block decoration-0`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-3.5 rounded-2xl shadow-sm transition-colors ${isDarkMode ? 'bg-[#2C2C2E] group-hover:bg-[#3A3A3C]' : 'bg-gray-50 group-hover:bg-white'}`}>
                    {item.fileMimeType === 'application/pdf' ? (
                       <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                    ) : (
                       <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.sellerName || 'Nieznany sprzedawca'}</p>
                    <p className={`text-xs mt-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                       {item.date} • <span className={isDarkMode ? "text-indigo-400" : "text-indigo-600"}>{item.grossAmount.toFixed(2)} {item.currency}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block pl-4 max-w-[40%] truncate">
                   <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {properties.find(p => p.id === item.propertyId)?.address || 'Nieznany adres'}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderMethodSelection = () => (
    <div className="flex flex-col h-[70vh] animate-fade-in-up max-w-2xl mx-auto">
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
         <div className="text-center space-y-2">
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
        </div>
       </div>
    </div>
  );

  const renderReview = () => {
    if (!invoiceData) return null;
    const activeProperties = properties.filter(p => !p.isArchived);
    const isPdf = fileMimeType === 'application/pdf';

    return (
      <div className={`w-full max-w-2xl mx-auto animate-fade-in-up pb-20`}>
        
        {/* Document Preview Header */}
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
                />
              </div>
              <div className={styles.listGroupItem}>
                <label className={styles.label}>Numer</label>
                <input 
                  type="text" 
                  value={invoiceData.invoiceNumber}
                  onChange={e => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                  className={styles.inputTransparent}
                />
              </div>
              <div className={styles.listGroupItem}>
                <label className={styles.label}>Data</label>
                <input 
                  type="date" 
                  value={invoiceData.date}
                  onChange={e => setInvoiceData({...invoiceData, date: e.target.value})}
                  className={styles.inputTransparent}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financials */}
          <div>
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 px-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Kwoty</h4>
            <div className={styles.listGroupContainer}>
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
              {/* Gross Amount Highlight */}
              <div className={`flex items-center justify-between p-6 ${isDarkMode ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
                <label className={`font-bold uppercase tracking-wide ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                   Brutto
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
               disabled={!selectedPropertyId}
               className={`flex-1 py-4 px-6 rounded-2xl font-bold shadow-xl transition-all transform hover:-translate-y-1 active:scale-95 ${
                 !selectedPropertyId 
                   ? (isDarkMode ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')
                   : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30 hover:shadow-blue-500/50'
               }`}
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
          Faktura została przeanalizowana i zapisana. Dane są w Arkuszu, a plik na Dysku Google.
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
             onClick={status === ProcessingStatus.SELECT_METHOD ? () => setStatus(ProcessingStatus.IDLE) : undefined}
          >
            {/* LOGO */}
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg overflow-hidden shrink-0 transition-transform duration-500 ${isDarkMode ? 'bg-[#1C1C1E] border border-gray-700' : 'bg-white border border-gray-100'}`}>
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