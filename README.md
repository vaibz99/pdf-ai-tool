# AI-Powered PDF Interaction Tool

A modern, full-stack application that allows users to visually select regions in PDF documents and ask AI-powered questions about the selected content.

## Features

- **PDF Viewing**: High-quality PDF rendering with navigation and zoom controls
- **Visual Selection**: Drag to select any region in the PDF with precise text extraction
- **AI Integration**: Ask questions about selected text using GPT-4 Turbo or Claude
- **Document Search**: Full-text search across the entire document with page navigation
- **Theme Support**: Light/dark mode toggle with localStorage persistence
- **Responsive Design**: Works on desktop and mobile devices
- **Caching**: Intelligent response caching to reduce API costs

## Tech Stack

- **Frontend**: React 18+, TypeScript, Tailwind CSS, PDF.js
- **Backend**: Node.js, Express, OpenAI API, Anthropic API
- **Build Tool**: Vite
- **Icons**: Lucide React

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
# At least one API key is required
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

PORT=3001
```

### 3. Add Sample PDF

Place a PDF file named `sample.pdf` in the `public/` directory. This will be the default document loaded by the application.

### 4. Run the Application

Start both frontend and backend:
```bash
npm run dev
```

This runs:
- Frontend dev server on `http://localhost:5173`
- Backend API server on `http://localhost:3001`

## API Configuration

### OpenAI (Primary)
- Get API key from: https://platform.openai.com/api-keys
- Uses GPT-4 Turbo model for best results
- Recommended for production use

### Anthropic (Fallback)
- Get API key from: https://console.anthropic.com/
- Uses Claude 3 Sonnet model
- Alternative option with similar quality

### Fallback Mode
If no API keys are configured, the app runs in fallback mode with basic keyword-based responses for demonstration purposes.

## Usage

1. **Load PDF**: The app loads `/public/sample.pdf` by default
2. **Navigate**: Use page controls to browse through the document
3. **Select Text**: Drag to create a selection rectangle over any region
4. **Ask Questions**: Enter your question about the selected text
5. **Get Answers**: The AI will respond based strictly on the selected content
6. **Search**: Use the search panel to find text across the entire document
7. **Theme**: Toggle between light and dark modes

## API Endpoints

### POST /api/ask
Submit a question about selected text.

**Request:**
```json
{
  "context": "Selected text from PDF",
  "question": "What is this about?"
}
```

**Response:**
```json
{
  "answer": "AI-generated answer based on the context",
  "source": "GPT-4 Turbo"
}
```

### GET /api/health
Check API status and available models.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "models": {
    "openai": true,
    "anthropic": false,
    "fallback": false
  }
}
```

## Features in Detail

### Text Selection Algorithm
- Uses PDF.js `getTextContent()` for accurate text extraction
- Calculates bounding boxes for each text item
- Filters items based on 30% overlap threshold with selection
- Sorts text items to preserve reading order
- Filters out large headings unless explicitly selected

### Caching System
- Caches responses for 24 hours to reduce API costs
- Cache key based on context + question hash
- Automatic cache invalidation

### Error Handling
- Graceful fallback when APIs are unavailable
- User-friendly error messages
- Rate limit and quota protection

## Development

### File Structure
```
src/
├── components/
│   ├── PDFViewer.tsx       # Main PDF rendering and selection
│   ├── QuestionPanel.tsx   # AI question interface
│   ├── SearchPanel.tsx     # Document search functionality
│   └── ThemeProvider.tsx   # Theme management
├── App.tsx                 # Main application component
└── main.tsx               # Application entry point

server/
└── index.js               # Express server with AI adapters
```

### Build for Production
```bash
npm run build
npm run preview
```

## License

MIT License - feel free to use and modify for your projects.