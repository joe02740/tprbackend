/**
 * Book Intelligence Routes
 *
 * Lightweight AI endpoints that run on Gemini Flash for cost efficiency.
 * - Book summary generation (once per book, cached client-side)
 * - Chapter review (summary + quiz + key terms)
 * - Word definition for vocab lists
 */

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

function extractVertexText(result) {
  const candidate = result?.response?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No text in Vertex AI response');
  return text.trim();
}

// Lazy-init a dedicated Gemini Flash instance for book intelligence.
// Uses Vertex AI SDK (service account auth via Cloud Run ADC) — no API key needed.
let geminiFlash = null;

async function getGeminiFlash() {
  if (geminiFlash) return geminiFlash;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.VERTEX_AI_LOCATION || 'us-east5';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');
  }

  const { VertexAI } = await import('@google-cloud/vertexai');
  const vertex = new VertexAI({ project: projectId, location });
  geminiFlash = vertex.getGenerativeModel({ model: 'gemini-2.0-flash' });
  logger.info(`✅ Gemini Flash (Vertex AI) initialized for book intelligence [${location}]`);
  return geminiFlash;
}

/**
 * POST /api/book-intelligence/summary
 *
 * Generate a book summary from the opening text. Called once per book
 * after import. The app caches the result in the local DB.
 *
 * Body: { title, author?, openingText (first ~5000 chars of clean text) }
 * Returns: { summary, genre, themes, setting, mainCharacters }
 */
router.post('/summary', async (req, res) => {
  try {
    const { title, author, openingText } = req.body;

    if (!openingText || openingText.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'openingText is required (at least 50 characters)'
      });
    }

    const model = await getGeminiFlash();

    const prompt = `You are analyzing a book to create a brief reference summary that will help an AI reading companion answer questions about passages later.

Book title: "${title || 'Unknown'}"${author ? `\nAuthor: ${author}` : ''}

Here is the opening text of the book (first ~5000 characters):

---
${openingText.substring(0, 5500)}
---

Based on this opening, provide a JSON response with these fields:
- "summary": A 3-4 sentence summary of what this book appears to be about, its tone, and style. If this is non-fiction or a textbook, note the subject matter and approach.
- "genre": The genre/category (e.g. "historical fiction", "science textbook", "philosophy", "fantasy novel", "memoir")
- "themes": An array of 3-5 key themes (e.g. ["ambition", "power", "betrayal"])
- "setting": A brief description of the setting/time period, or "N/A" for non-fiction
- "mainCharacters": An array of character names and brief descriptions seen so far, or empty array for non-fiction. Max 5.

Respond with ONLY valid JSON, no markdown fences.`;

    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600
      }
    });

    const rawResponse = extractVertexText(result);

    // Parse the JSON response, stripping markdown fences if present
    let parsed;
    try {
      const cleaned = rawResponse.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      parsed = { summary: rawResponse, genre: 'unknown', themes: [], setting: 'unknown', mainCharacters: [] };
    }

    logger.info(`Book summary generated for "${title}": ${parsed.genre}`);

    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    logger.error(`Error generating book summary: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate book summary'
    });
  }
});

/**
 * POST /api/book-intelligence/chapter-review
 *
 * Generate end-of-chapter summary, quiz questions, and key vocabulary.
 *
 * Body: { title, author?, bookSummary?, chapterText, chapterNumber? }
 * Returns: { summary, quiz: [{question, options, correctIndex, explanation}], keyTerms: [{term, definition}] }
 */
router.post('/chapter-review', async (req, res) => {
  try {
    const { title, author, bookSummary, chapterText, chapterNumber } = req.body;

    if (!chapterText || chapterText.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'chapterText is required (at least 100 characters)'
      });
    }

    const model = await getGeminiFlash();

    // Truncate to ~8000 chars to keep costs low while capturing the chapter
    const truncatedChapter = chapterText.substring(0, 8000);

    const prompt = `You are a study companion helping a reader review what they just read.

Book: "${title || 'Unknown'}"${author ? ` by ${author}` : ''}${chapterNumber ? `\nChapter: ${chapterNumber}` : ''}${bookSummary ? `\nBook context: ${bookSummary}` : ''}

Here is the chapter/section text:

---
${truncatedChapter}
---

Create a study review in JSON format with these fields:
- "summary": A 3-5 sentence summary of this chapter's key events, arguments, or concepts.
- "quiz": An array of 3-5 multiple-choice questions testing comprehension. Each question has:
  - "question": the question text
  - "options": array of 4 answer choices
  - "correctIndex": index (0-3) of the correct answer
  - "explanation": brief explanation of why the answer is correct
- "keyTerms": An array of 3-8 important terms/concepts from this chapter, each with:
  - "term": the word or phrase
  - "definition": its meaning in the context of this text

Respond with ONLY valid JSON, no markdown fences.`;

    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500
      }
    });

    const rawResponse = extractVertexText(result);

    let parsed;
    try {
      const cleaned = rawResponse.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      parsed = { summary: rawResponse, quiz: [], keyTerms: [] };
    }

    logger.info(`Chapter review generated for "${title}" ch.${chapterNumber || '?'}: ${parsed.quiz?.length || 0} questions`);

    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    logger.error(`Error generating chapter review: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate chapter review'
    });
  }
});

/**
 * POST /api/book-intelligence/define
 *
 * Quick word/phrase definition for vocab list building.
 * Cheaper than the full AI text-query pipeline.
 *
 * Body: { word, sentenceContext?, bookTitle? }
 * Returns: { definition, partOfSpeech, example }
 */
router.post('/define', async (req, res) => {
  try {
    const { word, sentenceContext, bookTitle } = req.body;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'word is required'
      });
    }

    const model = await getGeminiFlash();

    const prompt = `Define the word or phrase "${word}"${sentenceContext ? ` as used in: "${sentenceContext}"` : ''}${bookTitle ? ` (from the book "${bookTitle}")` : ''}.

Respond with JSON:
- "definition": clear, concise definition (1-2 sentences)
- "partOfSpeech": (noun, verb, adjective, etc.)
- "example": a simple example sentence using the word

Respond with ONLY valid JSON, no markdown fences.`;

    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200
      }
    });

    const rawResponse = extractVertexText(result);

    let parsed;
    try {
      const cleaned = rawResponse.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      parsed = { definition: rawResponse, partOfSpeech: '', example: '' };
    }

    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    logger.error(`Error defining word: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to define word'
    });
  }
});

module.exports = router;
