import React from 'react';
import { Search, MapPin } from 'lucide-react';

interface SearchPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Array<{text: string, page: number}>;
  onJumpToPage: (page: number) => void;
}

export default function SearchPanel({
  searchQuery,
  setSearchQuery,
  searchResults,
  onJumpToPage
}: SearchPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Search Document
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for keywords..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchQuery.trim() && (
          <div className="mb-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </p>
          </div>
        )}

        <div className="space-y-3">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
              onClick={() => onJumpToPage(result.page)}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  <MapPin className="w-3 h-3 mr-1" />
                  Page {result.page}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                ...{result.text}...
              </p>
            </div>
          ))}
        </div>

        {searchQuery.trim() && searchResults.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              No results found for "{searchQuery}"
            </p>
          </div>
        )}

        {!searchQuery.trim() && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Enter keywords to search the document
            </p>
          </div>
        )}
      </div>
    </div>
  );
}