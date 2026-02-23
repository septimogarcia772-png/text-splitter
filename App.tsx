
import React, { useState, useRef } from 'react';
import { TextBlock, BlockType } from './types';

const MAX_CHARS = 4950;

const App: React.FC = () => {
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [totalChars, setTotalChars] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Split text logic without arbitrary block limit
  const splitText = (text: string): TextBlock[] => {
    const result: TextBlock[] = [];
    let currentPos = 0;
    let specialTriggered = false;
    const sanitizedText = text.replace(/\r\n/g, '\n');
    const fileId = Date.now().toString(36);

    while (currentPos < sanitizedText.length) {
      let endPos = currentPos + MAX_CHARS;
      
      if (endPos < sanitizedText.length) {
        const lastNewLine = sanitizedText.lastIndexOf('\n', endPos);
        if (lastNewLine > currentPos) {
          endPos = lastNewLine;
        }
      } else {
        endPos = sanitizedText.length;
      }

      const chunk = sanitizedText.slice(currentPos, endPos);
      const containsSpecial = chunk.includes('[&$]');
      
      let type = BlockType.NORMAL;
      if (specialTriggered) {
        type = BlockType.POST_SPECIAL;
      } else if (containsSpecial) {
        type = BlockType.SPECIAL_TRIGGER;
        specialTriggered = true;
      }

      result.push({
        // Combine file timestamp, index and content length for a robust unique key
        id: `block-${fileId}-${result.length}-${chunk.length}`,
        content: chunk,
        type: type
      });

      currentPos = endPos;
      if (sanitizedText[currentPos] === '\n') {
        currentPos++;
      }
    }

    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      try {
        // @ts-ignore - mammoth is loaded via script tag in index.html
        const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        setTotalChars(text.length);
        const generatedBlocks = splitText(text);
        setBlocks(generatedBlocks);
        setActiveBlockIndex(null);
        blockRefs.current.clear();
      } catch (err) {
        console.error('Error parsing .docx file:', err);
        alert('Error al procesar el archivo .docx. Por favor, asegúrese de que el archivo sea válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const resetApp = () => {
    const confirmed = window.confirm('¿Estás seguro de que deseas borrar todo el contenido y reiniciar la aplicación?');
    if (confirmed) {
      setBlocks([]);
      setTotalChars(0);
      setActiveBlockIndex(null);
      blockRefs.current.clear();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportAll = () => {
    if (blocks.length === 0) return;
    
    if (!window.confirm(`Se descargarán ${blocks.length} archivos de texto individuales. ¿Deseas continuar?`)) {
      return;
    }

    blocks.forEach((block, index) => {
      const blob = new Blob([block.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bloque_${index + 1}.txt`;
      
      // We use a small timeout to avoid triggering browser download/popup protections
      // for large numbers of files, though the user will likely still see a prompt.
      setTimeout(() => {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, index * 200);
    });
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleButtonClick = async (index: number) => {
    if (index >= blocks.length) return;
    
    const block = blocks[index];
    try {
      await navigator.clipboard.writeText(block.content);
      setActiveBlockIndex(index);
      
      const element = blockRefs.current.get(block.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const getButtonColor = (index: number) => {
    const block = blocks[index];
    const isActive = activeBlockIndex === index;
    
    switch (block.type) {
      case BlockType.SPECIAL_TRIGGER:
        return isActive 
          ? 'bg-amber-600 text-white shadow-lg scale-105' 
          : 'bg-amber-500 text-white hover:bg-amber-400 ring-2 ring-amber-500/20';
      case BlockType.POST_SPECIAL:
        return isActive 
          ? 'bg-rose-600 text-white shadow-lg scale-105' 
          : 'bg-rose-500 text-white hover:bg-rose-400 ring-2 ring-rose-500/20';
      default:
        return isActive 
          ? (isDarkMode ? 'bg-indigo-500 text-white shadow-lg scale-105' : 'bg-indigo-600 text-white shadow-lg scale-105')
          : (isDarkMode ? 'bg-indigo-700 text-indigo-100 hover:bg-indigo-600' : 'bg-indigo-500 text-white hover:bg-indigo-400');
    }
  };

  const getHighlightStyle = (index: number) => {
    if (activeBlockIndex !== index) return '';
    
    const block = blocks[index];
    switch (block.type) {
      case BlockType.SPECIAL_TRIGGER: 
        return isDarkMode ? 'bg-amber-900/20 border-l-4 border-amber-500' : 'bg-amber-100 border-l-4 border-amber-500';
      case BlockType.POST_SPECIAL: 
        return isDarkMode ? 'bg-rose-900/20 border-l-4 border-rose-500' : 'bg-rose-100 border-l-4 border-rose-500';
      default: 
        return isDarkMode ? 'bg-indigo-900/20 border-l-4 border-indigo-500' : 'bg-indigo-100 border-l-4 border-indigo-500';
    }
  };

  return (
    <div className={`flex flex-col h-screen w-full transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Header */}
      <header className={`flex-none p-4 border-b flex flex-wrap justify-between items-center z-20 shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">Text Splitter Pro</h1>
          {totalChars > 0 && (
            <div className="flex items-center gap-2 mt-0.5" role="status" aria-label="Estadísticas del documento">
              <span className={`text-[10px] md:text-xs font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {totalChars.toLocaleString()} caracteres
              </span>
              <span className={`text-[10px] md:text-xs font-medium px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                {blocks.length} bloques
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 mt-2 sm:mt-0">
          <button 
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "Activar modo claro" : "Activar modo oscuro"}
            aria-pressed={isDarkMode}
            title="Cambiar modo visual"
            className={`p-2 rounded-lg transition-all duration-300 flex items-center justify-center ${isDarkMode ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'}`}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>
            )}
          </button>

          {blocks.length > 0 && (
            <button 
              onClick={handleExportAll}
              aria-label="Exportar todos los bloques a archivos .txt"
              title="Exportar bloques"
              className={`p-2 rounded-lg transition-all duration-300 flex items-center justify-center ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-500 hover:bg-emerald-600'} text-white shadow-sm`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

          <button 
            onClick={resetApp}
            aria-label="Reiniciar aplicación y borrar contenido"
            title="Reiniciar aplicación"
            className="bg-rose-600 text-white p-2 rounded-lg font-medium hover:bg-rose-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            aria-label="Cargar archivo Word (.docx)"
            className={`${isDarkMode ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Cargar .docx</span>
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".docx" 
          className="hidden" 
          aria-hidden="true"
          tabIndex={-1}
        />
      </header>

      {/* Main Area */}
      <main 
        ref={scrollContainerRef}
        role="feed"
        aria-busy={false}
        className={`flex-grow overflow-y-auto p-4 md:p-8 space-y-4 scroll-smooth transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}
      >
        {blocks.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center transition-opacity duration-300 ${isDarkMode ? 'text-slate-600' : 'text-slate-400 opacity-60'}`}>
            <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-center">Cargue un archivo .docx para comenzar a dividir el texto en bloques</p>
          </div>
        ) : (
          blocks.map((block, i) => (
            <article
              key={block.id}
              ref={(el) => { if (el) blockRefs.current.set(block.id, el); }}
              aria-labelledby={`block-heading-${i}`}
              className={`group p-6 rounded-xl transition-all duration-300 border whitespace-pre-wrap font-mono text-sm shadow-sm hover:shadow-md ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-100 text-slate-700'
              } ${getHighlightStyle(i)}`}
            >
              <div className={`flex justify-between items-center mb-4 border-b pb-2 transition-colors ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex flex-col">
                  <span id={`block-heading-${i}`} className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Bloque {i + 1}
                  </span>
                  <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    {block.content.length.toLocaleString()} caracteres
                  </span>
                </div>
                {activeBlockIndex === i && (
                  <span 
                    role="status" 
                    aria-live="polite"
                    className="text-[10px] bg-green-500 text-white px-3 py-1 rounded-full animate-pulse font-bold shadow-sm uppercase tracking-wider"
                  >
                    Copiado ✓
                  </span>
                )}
              </div>
              <div className="leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity">
                {block.content}
              </div>
            </article>
          ))
        )}
      </main>

      {/* Footer / Control Center */}
      <footer 
        className={`flex-none max-h-[35vh] border-t p-4 md:p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-300 overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
        aria-label="Panel de navegación de bloques"
      >
        <div className="max-w-6xl mx-auto">
          {blocks.length > 0 ? (
            <nav className="flex flex-wrap justify-center gap-2 md:gap-3" aria-label="Selección de bloque">
              {blocks.map((block, index) => (
                <button
                  key={`btn-${block.id}`}
                  onClick={() => handleButtonClick(index)}
                  aria-label={`Copiar bloque ${index + 1} al portapapeles`}
                  aria-current={activeBlockIndex === index ? 'step' : undefined}
                  className={`
                    min-w-[45px] h-[45px] md:min-w-[55px] md:h-[55px]
                    relative flex items-center justify-center rounded-xl font-bold text-base md:text-lg 
                    transition-all duration-300 shadow-sm
                    active:scale-90
                    focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'focus:ring-indigo-400 focus:ring-offset-slate-900' : 'focus:ring-indigo-600 focus:ring-offset-white'}
                    ${getButtonColor(index)}
                  `}
                >
                  {index + 1}
                  {activeBlockIndex === index && (
                     <div 
                       className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 ${isDarkMode ? 'bg-indigo-400 border-slate-900' : 'bg-white border-current shadow-sm'}`} 
                       aria-hidden="true" 
                     />
                  )}
                </button>
              ))}
            </nav>
          ) : (
            <div className={`flex items-center justify-center h-20 text-sm font-medium italic ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Los botones de navegación aparecerán aquí al cargar un documento.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
