import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, FolderOpen, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFViewerProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  setTotalPages: (total: number) => void;
  selectedText: string;
  setSelectedText: (text: string) => void;
  selection: {x: number, y: number, width: number, height: number} | null;
  setSelection: (selection: {x: number, y: number, width: number, height: number} | null) => void;
  searchQuery: string;
  setSearchResults: (results: Array<{text: string, page: number}>) => void;
  onPDFChange: () => void;
}

export default function PDFViewer({
  currentPage,
  setCurrentPage,
  totalPages,
  setTotalPages,
  selectedText,
  setSelectedText,
  selection,
  setSelection,
  searchQuery,
  setSearchResults,
  onPDFChange
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [pageTexts, setPageTexts] = useState<Map<number, any>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({x: 0, y: 0});
  const [scale, setScale] = useState(1.5);
  const [viewport, setViewport] = useState<any>(null);
  const [availablePDFs, setAvailablePDFs] = useState<Array<{name: string, file: File}>>([]);
  const [currentPDFName, setCurrentPDFName] = useState('sample.pdf');
  const [folderHandle, setFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [supportsFileSystemAccess, setSupportsFileSystemAccess] = useState(false);

  // Check File System Access API support
  useEffect(() => {
    setSupportsFileSystemAccess('showDirectoryPicker' in window);
  }, []);

  // Load folder handle from localStorage
  useEffect(() => {
    const loadFolderHandle = async () => {
      try {
        const stored = localStorage.getItem('pdf-folder-handle');
        if (stored && supportsFileSystemAccess) {
          // Note: In real implementation, you'd need to verify permission
          // For now, we'll just clear it and let user re-select
          localStorage.removeItem('pdf-folder-handle');
        }
      } catch (error) {
        console.log('Could not restore folder handle:', error);
      }
    };
    loadFolderHandle();
  }, [supportsFileSystemAccess]);

  // Load PDF from file or URL
  const loadPDF = async (source: string | File, filename?: string) => {
    try {
      setIsLoading(true);
      onPDFChange(); // Clear previous state
      
      let pdf;
      if (typeof source === 'string') {
        pdf = await pdfjsLib.getDocument(source).promise;
      } else {
        const arrayBuffer = await source.arrayBuffer();
        pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      }
      
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setCurrentPDFName(filename || 'document.pdf');
      
      // Preload all page texts for search functionality
      const texts = new Map();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        texts.set(i, textContent);
      }
      setPageTexts(texts);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setIsLoading(false);
    }
  };

  // Handle folder selection
  const handleFolderSelect = async () => {
    if (!supportsFileSystemAccess) {
      alert('Folder selection not supported in this browser. Please use file upload instead.');
      return;
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setFolderHandle(dirHandle);
      
      // Store handle reference (note: actual persistence requires more complex implementation)
      localStorage.setItem('pdf-folder-handle', 'stored');
      
      // Enumerate PDF files
      const pdfFiles: Array<{name: string, file: File}> = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.toLowerCase().endsWith('.pdf')) {
          const file = await handle.getFile();
          pdfFiles.push({ name, file });
        }
      }
      
      setAvailablePDFs(pdfFiles);
      
      // Load first PDF if available
      if (pdfFiles.length > 0) {
        await loadPDF(pdfFiles[0].file, pdfFiles[0].name);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
      }
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      await loadPDF(file, file.name);
      setAvailablePDFs([{ name: file.name, file }]);
    }
  };

  // Handle PDF selection from dropdown
  const handlePDFSelect = async (pdfName: string) => {
    const selectedPDF = availablePDFs.find(pdf => pdf.name === pdfName);
    if (selectedPDF) {
      await loadPDF(selectedPDF.file, selectedPDF.name);
    }
  };

  // Load PDF document
  useEffect(() => {
    // Load default PDF on mount
    loadPDF('/sample.pdf', 'sample.pdf');
  }, []);

  // Render current page
  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      const page = await pdfDocument.getPage(currentPage);
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      
      const viewport = page.getViewport({ scale });
      setViewport(viewport);
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport,
      };
      
      await page.render(renderContext).promise;
    };

    renderPage();
  }, [pdfDocument, currentPage, scale]);

  // Handle search across all pages
  useEffect(() => {
    if (!searchQuery.trim() || !pageTexts.size) {
      setSearchResults([]);
      return;
    }

    const results: Array<{text: string, page: number}> = [];
    const query = searchQuery.toLowerCase();

    pageTexts.forEach((textContent, pageNum) => {
      const fullText = textContent.items.map((item: any) => item.str).join(' ');
      if (fullText.toLowerCase().includes(query)) {
        // Find context around the match
        const index = fullText.toLowerCase().indexOf(query);
        const start = Math.max(0, index - 50);
        const end = Math.min(fullText.length, index + query.length + 50);
        const snippet = fullText.substring(start, end);
        
        results.push({
          text: snippet,
          page: pageNum
        });
      }
    });

    setSearchResults(results);
  }, [searchQuery, pageTexts, setSearchResults]);

  // Mouse event handlers for selection
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragStart({ x, y });
    setSelection(null);
    setSelectedText('');
  }, [setSelection, setSelectedText]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const selection = {
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y)
    };
    
    setSelection(selection);
  }, [isDragging, dragStart, setSelection]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !selection || !pageTexts.has(currentPage) || !viewport) {
      setIsDragging(false);
      return;
    }
    
    setIsDragging(false);
    
    // Extract text from selection area
    const textContent = pageTexts.get(currentPage);
    if (!textContent) return;

    const selectedItems: Array<{str: string, fontSize: number, y: number}> = [];
    
    textContent.items.forEach((item: any) => {
      // Calculate bounding box for this text item
      const transform = item.transform;
      const x = transform[4];
      const y = viewport.height - transform[5]; // PDF coordinates are bottom-up
      const width = item.width;
      const height = item.height || 12; // Fallback height
      
      // Check overlap with selection (at least 30% overlap for inclusion)
      const overlapX = Math.max(0, Math.min(selection.x + selection.width, x + width) - Math.max(selection.x, x));
      const overlapY = Math.max(0, Math.min(selection.y + selection.height, y + height) - Math.max(selection.y, y));
      const overlapArea = overlapX * overlapY;
      const itemArea = width * height;
      const overlapRatio = overlapArea / itemArea;
      
      if (overlapRatio >= 0.3) {
        selectedItems.push({
          str: item.str,
          fontSize: item.height || 12,
          y: y // Store y position for sorting
        });
      }
    });
    
    // Sort by vertical position (top to bottom) to preserve reading order
    selectedItems.sort((a, b) => a.y - b.y);
    
    // Heuristic: filter out large headings unless they make up most of the selection
    // This prevents accidentally grabbing page titles when selecting body text
    const avgFontSize = selectedItems.reduce((sum, item) => sum + item.fontSize, 0) / selectedItems.length;
    const filteredItems = selectedItems.filter(item => {
      const isLargeHeading = item.fontSize > avgFontSize * 1.5;
      const headingCount = selectedItems.filter(i => i.fontSize > avgFontSize * 1.5).length;
      const totalItems = selectedItems.length;
      
      // Keep headings if they make up >50% of selection or selection is very small
      return !isLargeHeading || (headingCount / totalItems > 0.5) || totalItems <= 3;
    });
    
    const extractedText = filteredItems.map(item => item.str).join(' ').trim();
    setSelectedText(extractedText);
  }, [isDragging, selection, pageTexts, currentPage, viewport, setSelectedText]);

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageJump = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pageNum = parseInt(formData.get('pageNum') as string);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  const clearSelection = () => {
    setSelection(null);
    setSelectedText('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-lg text-gray-600 dark:text-gray-300 mb-2">Loading PDF...</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{currentPDFName}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        {/* PDF Selection Row */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PDF:</span>
            
            {availablePDFs.length > 1 ? (
              <select
                value={currentPDFName}
                onChange={(e) => handlePDFSelect(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
              >
                {availablePDFs.map(pdf => (
                  <option key={pdf.name} value={pdf.name}>{pdf.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-gray-600 dark:text-gray-400">{currentPDFName}</span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {supportsFileSystemAccess && (
              <button
                onClick={handleFolderSelect}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors flex items-center"
                title="Choose folder containing PDFs"
              >
                <FolderOpen className="w-4 h-4 mr-1" />
                Choose Folder
              </button>
            )}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center"
              title="Upload PDF file"
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
        
        {/* Page Navigation Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <form onSubmit={handlePageJump} className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Page</span>
              <input
                name="pageNum"
                type="number"
                min="1"
                max={totalPages}
                defaultValue={currentPage}
                className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">of {totalPages}</span>
            </form>
            
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            {selection && (
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-1 inline" />
                Clear Selection
              </button>
            )}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                -
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[3rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale(Math.min(3, scale + 0.25))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Canvas Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4"
      >
        <div className="flex justify-center">
          <div className="relative bg-white shadow-lg">
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
            
            {/* Selection overlay */}
            {selection && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}