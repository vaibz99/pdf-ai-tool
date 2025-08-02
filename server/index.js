import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Cache for responses (24 hour TTL)
const responseCache = new NodeCache({ stdTTL: 86400 });

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

// Model adapters
class ModelAdapter {
  async generateResponse(context, question) {
    throw new Error('Not implemented');
  }
}

class OpenAIAdapter extends ModelAdapter {
  constructor(client) {
    super();
    this.client = client;
  }

  async generateResponse(context, question) {
    const prompt = `Excerpt: "${context}"\n\nQuestion: "${question}"\n\nAnswer using only the excerpt. If insufficient, say: 'Not enough information in the selected excerpt to answer that.'`;
    
    const completion = await this.client.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based strictly on provided text excerpts. Be concise and accurate."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    return {
      answer: completion.choices[0].message.content.trim(),
      source: 'GPT-4 Turbo'
    };
  }
}

class AnthropicAdapter extends ModelAdapter {
  constructor(client) {
    super();
    this.client = client;
  }

  async generateResponse(context, question) {
    const prompt = `Excerpt: "${context}"\n\nQuestion: "${question}"\n\nAnswer using only the excerpt. If insufficient, say: 'Not enough information in the selected excerpt to answer that.'`;
    
    const completion = await this.client.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 500,
      temperature: 0.1,
      messages: [{
        role: "user",
        content: prompt
      }]
    });

    return {
      answer: completion.content[0].text.trim(),
      source: 'Claude 3 Sonnet'
    };
  }
}

// Fallback adapter for when no API keys are provided
class FallbackAdapter extends ModelAdapter {
  async generateResponse(context, question) {
    // Enhanced demo responses for better user experience
    const contextLower = context.toLowerCase();
    const questionLower = question.toLowerCase();
    
    // Simulate processing delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Generate contextual responses based on question type
    if (questionLower.includes('what')) {
      return {
        answer: `Based on the selected text: "${context.substring(0, 150)}${context.length > 150 ? '...' : ''}", this appears to be discussing the main topic or concept mentioned in the excerpt. For more detailed analysis, please configure OpenAI or Anthropic API keys.`,
        source: 'Demo Mode'
      };
    }
    
    if (questionLower.includes('how')) {
      return {
        answer: `The selected text describes a process or method. From the excerpt: "${context.substring(0, 100)}${context.length > 100 ? '...' : ''}", I can identify the procedural elements, but a full AI model would provide more comprehensive analysis.`,
        source: 'Demo Mode'
      };
    }
    
    if (questionLower.includes('why')) {
      return {
        answer: `The reasoning or explanation appears to be contained within the selected text. The excerpt suggests certain causes or motivations, but for detailed analysis of the "why" behind this content, please enable AI model integration.`,
        source: 'Demo Mode'
      };
    }
    
    if (questionLower.includes('who') || questionLower.includes('when') || questionLower.includes('where')) {
      return {
        answer: `I can identify specific details in the selected text that relate to your question. The excerpt contains relevant information, but for precise extraction of names, dates, or locations, please configure AI API keys for full functionality.`,
        source: 'Demo Mode'
      };
    }
    
    // Default response for other question types
    return {
      answer: `I can see the selected text contains: "${context.substring(0, 120)}${context.length > 120 ? '...' : ''}" - This demo mode provides basic responses. For intelligent analysis and detailed answers, please add your OpenAI or Anthropic API key to the .env file.`,
      source: 'Demo Mode'
    };
  }
}

// Select the appropriate model adapter
function getModelAdapter(preferredModel) {
  if (preferredModel === 'openai' && openai) {
    return new OpenAIAdapter(openai);
  } else if (preferredModel === 'anthropic' && anthropic) {
    return new AnthropicAdapter(anthropic);
  } else if (openai) {
    return new OpenAIAdapter(openai);
  } else if (anthropic) {
    return new AnthropicAdapter(anthropic);
  } else {
    return new FallbackAdapter();
  }
}

// API Routes
app.post('/api/ask', async (req, res) => {
  try {
    const { context, question, model } = req.body;

    // Validate input
    if (!context || !question) {
      return res.status(400).json({
        error: 'Both context and question are required'
      });
    }

    if (context.length > 10000) {
      return res.status(400).json({
        error: 'Context text is too long (max 10,000 characters)'
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        error: 'Question is too long (max 1,000 characters)'
      });
    }

    // Create cache key
    const cacheKey = Buffer.from(`${context}|${question}`).toString('base64');
    
    // Check cache first
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      console.log('Cache hit for question');
      return res.json(cachedResponse);
    }

    // Get model adapter and generate response
    const adapter = getModelAdapter(model);
    const response = await adapter.generateResponse(context, question);

    // Cache the response
    responseCache.set(cacheKey, response);

    console.log(`Generated response using ${response.source}`);
    res.json(response);

  } catch (error) {
    console.error('Error in /api/ask:', error);
    
    // Handle specific API errors
    if (error.message?.includes('API key')) {
      return res.status(401).json({
        error: 'Invalid API key configuration'
      });
    }
    
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      error: 'Internal server error. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    models: {
      openai: !!openai,
      anthropic: !!anthropic,
      fallback: !openai && !anthropic
    }
  };
  
  res.json(status);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend should proxy /api requests to this server`);
  console.log('Available models:');
  console.log('- OpenAI:', openai ? '✓' : '✗');
  console.log('- Anthropic:', anthropic ? '✓' : '✗');
  console.log('- Fallback:', !openai && !anthropic ? '✓' : '✗');
  
  // Test endpoint
  console.log('\nTest the server:');
  console.log(`curl http://localhost:${PORT}/api/health`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  process.exit(0);
});