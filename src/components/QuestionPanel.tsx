import React, { useState } from 'react';
import { MessageSquare, Copy, Loader2, AlertCircle, CheckCircle, Settings, Zap } from 'lucide-react';

interface QuestionPanelProps {
  selectedText: string;
  selection: {x: number, y: number, width: number, height: number} | null;
  onClearSelection: () => void;
  apiMode: 'fallback' | 'openai' | 'anthropic';
  onApiModeChange: (mode: 'fallback' | 'openai' | 'anthropic') => void;
}

interface AIResponse {
  answer: string;
  source?: string;
}

// Client-side fallback AI responses - no backend dependency
const generateFallbackResponse = async (context: string, question: string): Promise<AIResponse> => {
  // Simulate realistic processing delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
  
  const contextLower = context.toLowerCase();
  const questionLower = question.toLowerCase();
  const contextPreview = context.substring(0, 120) + (context.length > 120 ? '...' : '');
  
  // Pattern-aware responses based on question type
  if (questionLower.includes('what')) {
    if (contextLower.includes('definition') || contextLower.includes('means') || contextLower.includes('is')) {
      return {
        answer: `Based on the selected text, this appears to define or describe a concept. The excerpt mentions key terms and provides context about the subject matter. From "${contextPreview}", I can identify the main topic being discussed.`,
        source: 'Demo Mode'
      };
    }
    return {
      answer: `The selected text discusses: "${contextPreview}". This appears to be explaining the nature, characteristics, or details of the subject matter mentioned in your question.`,
      source: 'Demo Mode'
    };
  }
  
  if (questionLower.includes('how')) {
    return {
      answer: `The excerpt describes a process or methodology. From the selected text: "${contextPreview}", I can identify procedural steps or explanations of how something works or is accomplished. The text provides guidance on the approach or mechanism involved.`,
      source: 'Demo Mode'
    };
  }
  
  if (questionLower.includes('why')) {
    return {
      answer: `The reasoning appears to be contained within the selected text. The excerpt suggests causes, motivations, or explanations for the phenomenon in question. Based on "${contextPreview}", there are underlying factors or justifications mentioned.`,
      source: 'Demo Mode'
    };
  }
  
  if (questionLower.includes('who') || questionLower.includes('when') || questionLower.includes('where')) {
    return {
      answer: `The selected text contains specific details relevant to your question. From "${contextPreview}", I can identify references to people, places, times, or other specific information that addresses the who/when/where aspects you're asking about.`,
      source: 'Demo Mode'
    };
  }
  
  if (questionLower.includes('compare') || questionLower.includes('difference') || questionLower.includes('similar')) {
    return {
      answer: `The excerpt provides information for comparison. From "${contextPreview}", I can identify different elements, characteristics, or approaches that can be contrasted or compared as requested in your question.`,
      source: 'Demo Mode'
    };
  }
  
  // Default contextual response
  return {
    answer: `Based on the selected excerpt: "${contextPreview}", I can provide relevant information to address your question. The text contains details that relate to your inquiry, though a full AI model would offer more comprehensive analysis and deeper insights.`,
    source: 'Demo Mode'
  };
};

export default function QuestionPanel({
  selectedText,
  selection,
  onClearSelection,
  apiMode,
  onApiModeChange
}: QuestionPanelProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);

  // Generate the prompt that will be sent to the AI
  const generatePrompt = () => {
    if (!selectedText.trim() || !question.trim()) return '';
    
    return `Excerpt: "${selectedText}"\n\nQuestion: "${question}"\n\nAnswer using only the excerpt. If insufficient, say: 'Not enough information in the selected excerpt to answer that.'`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedText.trim()) {
      setError('Please select some text from the PDF first');
      return;
    }
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);

    try {
      if (apiMode === 'fallback') {
        // Use client-side fallback - no backend call
        const response = await generateFallbackResponse(selectedText, question);
        setAnswer(response);
      } else {
        // Call real backend API
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: selectedText,
            question: question,
            model: apiMode
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: AIResponse = await response.json();
        setAnswer(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get answer';
      
      // If real API fails, offer fallback
      if (apiMode !== 'fallback') {
        setError(`${errorMessage}. Switching to demo mode...`);
        setTimeout(() => {
          onApiModeChange('fallback');
          setError(null);
        }, 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const clearAll = () => {
    setQuestion('');
    setAnswer(null);
    setError(null);
    setShowPrompt(false);
    onClearSelection();
  };

  // Check if API keys are available (simplified check)
  const hasRealAPI = apiMode !== 'fallback';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Ask AI
          </h2>
          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="API Configuration"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        
        {/* API Mode Banner */}
        {apiMode === 'fallback' && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center text-sm text-amber-800 dark:text-amber-200">
              <Zap className="w-4 h-4 mr-2" />
              Demo mode active — configure API key for real AI answers
            </div>
          </div>
        )}
        
        {/* API Configuration Panel */}
        {showApiConfig && (
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Provider</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="apiMode"
                  value="fallback"
                  checked={apiMode === 'fallback'}
                  onChange={(e) => onApiModeChange(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Demo Mode (No API key needed)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="apiMode"
                  value="openai"
                  checked={apiMode === 'openai'}
                  onChange={(e) => onApiModeChange(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">OpenAI GPT-4 Turbo</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="apiMode"
                  value="anthropic"
                  checked={apiMode === 'anthropic'}
                  onChange={(e) => onApiModeChange(e.target.value as any)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Anthropic Claude</span>
              </label>
            </div>
          </div>
        )}
        
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Select text in the PDF and ask questions about it
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Selected Text Display */}
        {selectedText && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Selected Text
              </h3>
              <button
                onClick={() => copyToClipboard(selectedText)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                title="Copy selected text"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {selectedText}
            </p>
          </div>
        )}

        {/* Question Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about the selected text?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            />
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={isLoading || !selectedText.trim() || !question.trim()}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {apiMode === 'fallback' ? 'Thinking...' : 'Asking AI...'}
                </>
              ) : (
                apiMode === 'fallback' ? 'Ask Demo AI' : 'Ask AI'
              )}
            </button>
            
            <button
              type="button"
              onClick={clearAll}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>

        {/* Prompt Preview Toggle */}
        {(selectedText || question) && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
          >
            {showPrompt ? 'Hide' : 'Show'} AI Prompt
          </button>
        )}

        {/* Prompt Preview */}
        {showPrompt && generatePrompt() && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                AI Prompt
              </h3>
              <button
                onClick={() => copyToClipboard(generatePrompt())}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                title="Copy prompt"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {generatePrompt()}
            </pre>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Answer Display */}
        {answer && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-900 dark:text-green-300 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                AI Answer
                {answer.source && (
                  <span className="ml-2 text-xs bg-green-100 dark:bg-green-800 px-2 py-1 rounded">
                    {answer.source}
                  </span>
                )}
              </h3>
              <button
                onClick={() => copyToClipboard(answer.answer)}
                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                title="Copy answer"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
              {answer.answer}
            </p>
          </div>
        )}

        {/* Help Text */}
        {!selectedText && (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <MessageSquare className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Select text from the PDF by dragging to highlight a region, then ask questions about it
            </p>
          </div>
        )}
      </div>
    </div>
  );
}