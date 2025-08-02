import React, { useState, useEffect } from 'react';
import { Moon, Sun, Search, FileText, Zap } from 'lucide-react';
import PDFViewer from './components/PDFViewer';
import SearchPanel from './components/SearchPanel';
import QuestionPanel from './components/QuestionPanel';
import ThemeProvider from './components/ThemeProvider';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [selection, setSelection] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{text: string, page: number}>>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [apiMode, setApiMode] = useState<'fallback' | 'openai' | 'anthropic'>('fallback');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('pdf-tool-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('pdf-tool-theme', newTheme);
  };

  // Load API mode from localStorage
  useEffect(() => {
    const savedApiMode = localStorage.getItem('pdf-tool-api-mode') as 'fallback' | 'openai' | 'anthropic' | null;
    if (savedApiMode) {
      setApiMode(savedApiMode);
    }
  }, []);

  // Save API mode to localStorage
  const handleApiModeChange = (mode: 'fallback' | 'openai' | 'anthropic') => {
    setApiMode(mode);
    localStorage.setItem('pdf-tool-api-mode', mode);
  };

  // Clear selection and related state when page changes
  useEffect(() => {
    clearAllState();
  }, [currentPage]);

  // Function to clear all state (called on page change or PDF change)
  const clearAllState = () => {
    setSelectedText('');
    setSelection(null);
    // Note: We don't clear question/answer here as user might want to keep them
    // when navigating pages. QuestionPanel has its own clear function.
  };

  // Handle PDF change (new PDF loaded)
  const handlePDFChange = () => {
    clearAllState();
    setCurrentPage(1);
    setTotalPages(0);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <ThemeProvider theme={theme}>
      <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI PDF Analyzer
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Search document"
              >
                <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-gray-600" />
                ) : (
                  <Sun className="w-5 h-5 text-yellow-400" />
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex h-[calc(100vh-80px)]">
          {/* PDF Viewer */}
          <div className="flex-1 relative">
            <PDFViewer
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              setTotalPages={setTotalPages}
              selectedText={selectedText}
              setSelectedText={setSelectedText}
              selection={selection}
              setSelection={setSelection}
              searchQuery={searchQuery}
              setSearchResults={setSearchResults}
              onPDFChange={handlePDFChange}
            />
          </div>

          {/* Right Sidebar */}
          <div className="w-96 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-hidden">
            {isSearchOpen ? (
              <SearchPanel
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                onJumpToPage={setCurrentPage}
              />
            ) : (
              <QuestionPanel
                selectedText={selectedText}
                selection={selection}
                onClearSelection={clearAllState}
                apiMode={apiMode}
                onApiModeChange={handleApiModeChange}
              />
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;