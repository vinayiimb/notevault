import { Anthropic } from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

export interface AIService {
  generateMicroNotes(content: string, level: string): Promise<string>;
  generateFlashcards(content: string): Promise<Array<{ front: string; back: string }>>;
  generateQuiz(content: string, type: string, count: number): Promise<any>;
  generateMindmap(content: string): Promise<any>;
  answerFromSources(question: string, context: string): Promise<string>;
  generateRevisionSheet(content: string, durationMinutes: number): Promise<string>;
}

// Default to Anthropic since it's typically better at complex JSON & generation
export class AnthropicAIService implements AIService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
  }

  async generateMicroNotes(content: string, level: string = 'Standard'): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      system: `You are an expert tutor creating highly compressed micro notes. Level: ${level}. Focus on definitions, keywords, dates, formulas, people, theories, facts, and examples. Avoid unnecessary prose.`,
      messages: [{ role: 'user', content }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  async generateFlashcards(content: string): Promise<Array<{ front: string; back: string }>> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      system: `Create flashcards from the provided content. Output ONLY a JSON array of objects with 'front' and 'back' string properties. No other text.`,
      messages: [{ role: 'user', content }],
    });
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse flashcards:', e);
      return [];
    }
  }

  async generateQuiz(content: string, type: string, count: number): Promise<any> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      system: `Generate a ${count}-question quiz of type ${type} based on the content. Output ONLY a JSON array of questions with text, options (if MCQ), correctAnswer, and explanation.`,
      messages: [{ role: 'user', content }],
    });
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse quiz:', e);
      return [];
    }
  }

  async generateMindmap(content: string): Promise<any> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2000,
      system: `Create a mind map from the content. Output ONLY a JSON object representing a hierarchical tree (id, name, children[]).`,
      messages: [{ role: 'user', content }],
    });
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse mindmap:', e);
      return { id: 'root', name: 'Topic', children: [] };
    }
  }

  async answerFromSources(question: string, context: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1500,
      system: `Answer the question based STRICTLY on the provided context. If the answer is not in the context, say so clearly. Do not hallucinate.`,
      messages: [{ role: 'user', content: `Context:\n${context}\n\nQuestion:\n${question}` }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  async generateRevisionSheet(content: string, durationMinutes: number): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 2500,
      system: `Create an Exam Revision Sheet tailored for a ${durationMinutes}-minute study session. Include key definitions, facts, formulas, common mistakes, and likely questions. Format in Markdown.`,
      messages: [{ role: 'user', content }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }
}

// Export a singleton instance
export const ai = new AnthropicAIService();
