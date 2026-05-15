/**
 * AI Service - OpenAI Integration
 * Handles question generation, answer analysis, and feedback
 */

const OpenAI = require('openai');
const { Readable } = require('stream');

const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// ─── Generate Interview Questions ─────────────────────────────────────────────
const generateQuestions = async ({ targetRole, skills, difficulty, mode, count = 5, resumeText = '', language = 'en', previousQuestions = [] }) => {
  try {
    const difficultyGuide = {
      easy: 'beginner-friendly, conceptual questions',
      medium: 'intermediate questions requiring practical knowledge',
      hard: 'advanced questions requiring deep expertise and complex scenarios',
    };

    const modeGuide = {
      hr: 'behavioral, cultural fit, and soft-skill questions (STAR method encouraged)',
      technical: 'technical, problem-solving, and domain-specific questions',
      mixed: 'a balanced mix of behavioral and technical questions',
    };

    const previousQText = previousQuestions.length > 0
      ? `\nAVOID these already asked questions:\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const resumeContext = resumeText
      ? `\nCandidate Resume Context:\n${resumeText.substring(0, 1500)}`
      : '';

    const prompt = `You are an expert interviewer for ${targetRole || 'software engineering'} positions.
Generate exactly ${count} interview questions.

Configuration:
- Role: ${targetRole || 'Software Engineer'}
- Skills: ${skills.length > 0 ? skills.join(', ') : 'General programming'}
- Difficulty: ${difficulty} (${difficultyGuide[difficulty]})
- Mode: ${modeGuide[mode]}
- Language: ${language}${resumeContext}${previousQText}

IMPORTANT: Return ONLY a valid JSON array. No markdown, no explanation.
Format:
[
  {
    "text": "question text here",
    "type": "behavioral|technical|situational|general|hr",
    "difficulty": "${difficulty}",
    "category": "category name",
    "hint": "brief hint for what a good answer covers"
  }
]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content.trim();
    // Strip markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(jsonStr);

    return questions;
  } catch (err) {
    console.error('Question generation error:', err);
    // Fallback questions
    return getFallbackQuestions(mode, difficulty, count);
  }
};

// ─── Analyze Answer ───────────────────────────────────────────────────────────
const analyzeAnswer = async ({ question, answer, role, difficulty, language = 'en' }) => {
  try {
    if (!answer || answer.trim().length < 5) {
      return {
        relevanceScore: 0,
        clarityScore: 0,
        confidenceScore: 0,
        structureScore: 0,
        overallScore: 0,
        feedback: 'No answer was provided.',
        idealAnswer: '',
        strengths: [],
        improvements: ['Provide a complete answer to the question'],
      };
    }

    const prompt = `You are an expert interview coach.
Evaluate the candidate's answer to the question for the given role.

Question: "${question}"
Role: ${role || 'Software Engineer'}
Candidate's Answer: "${answer}"

Return ONLY a JSON object:
{
  "relevanceScore": <0-100>,
  "clarityScore": <0-100>,
  "confidenceScore": <0-100>,
  "structureScore": <0-100>,
  "overallScore": <0-100>,
  "feedback": "<2-3 sentences of feedback>",
  "idealAnswer": "<brief outline of key points>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Answer analysis error:', err);
    return {
      relevanceScore: 50,
      clarityScore: 50,
      confidenceScore: 50,
      structureScore: 50,
      overallScore: 50,
      feedback: 'Your answer has been recorded. Keep practicing to improve your responses.',
      idealAnswer: 'Unable to generate ideal answer at this time.',
      strengths: ['Answer provided'],
      improvements: ['Be more specific', 'Use concrete examples'],
    };
  }
};

// ─── Generate Session Summary ─────────────────────────────────────────────────
const generateSessionSummary = async ({ answers, role, mode }) => {
  try {
    const answersText = answers.map((a, i) =>
      `Q${i + 1}: ${a.question}\nAnswer: ${a.transcribedText}\nScore: ${a.aiAnalysis?.overallScore || 0}/100`
    ).join('\n\n');

    const prompt = `You are an expert interview coach. Summarize this interview session.

Role: ${role}
Interview Mode: ${mode}

Interview Q&A:
${answersText}

Return ONLY a valid JSON object:
{
  "overallFeedback": "<3-4 sentence overall assessment>",
  "strongestSkill": "<best performing area>",
  "weakestSkill": "<area needing most improvement>",
  "recommendedTopics": ["<topic 1>", "<topic 2>", "<topic 3>"],
  "overallScore": <0-100>
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('Session summary error:', err);
    const avgScore = answers.reduce((sum, a) => sum + (a.aiAnalysis?.overallScore || 0), 0) / Math.max(answers.length, 1);
    return {
      overallFeedback: 'Interview session completed. Review individual question feedback for detailed insights.',
      strongestSkill: 'Communication',
      weakestSkill: 'Technical depth',
      recommendedTopics: ['Data structures', 'System design', 'Behavioral questions'],
      overallScore: Math.round(avgScore),
    };
  }
};

// ─── Transcribe Audio ─────────────────────────────────────────────────────────
const transcribeAudio = async (audioBuffer, mimeType = 'audio/webm') => {
  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    console.log('=== TRANSCRIPTION START ===');
    console.log('Audio details:', { 
      bufferSize: audioBuffer.length, 
      mimeType,
    });
    console.log('API Key Status:', {
      exists: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 10) + '...',
      isPlaceholder: apiKey.includes('sk-...') || apiKey.includes('your-actual')
    });

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty');
    }

    if (!apiKey || apiKey.length < 20 || apiKey.includes('sk-...')) {
      throw new Error('Invalid OpenAI API key. Please check your .env file.');
    }

    // Force update the client key
    openai.apiKey = apiKey;

    // Determine file extension from MIME type
    let fileExtension = 'webm';
    if (mimeType.includes('mp4')) fileExtension = 'mp4';
    else if (mimeType.includes('mpeg')) fileExtension = 'mp3';
    else if (mimeType.includes('ogg')) fileExtension = 'ogg';
    else if (mimeType.includes('wav')) fileExtension = 'wav';
    else if (mimeType.includes('webm')) fileExtension = 'webm';
    else if (mimeType.includes('flac')) fileExtension = 'flac';

    const filename = `audio_${Date.now()}.${fileExtension}`;
    
    console.log('Calling OpenAI Whisper API with filename:', filename);
    
    const filePayload = await OpenAI.toFile(audioBuffer, filename);
    
    const response = await openai.audio.transcriptions.create(
      {
        file: filePayload,
        model: 'whisper-1',
        language: 'en',
      },
      {
        timeout: 60000,
      }
    );

    console.log('=== TRANSCRIPTION SUCCESS ===');
    console.log('Transcription response:', { 
      hasText: !!response.text,
      textLength: response.text?.length,
      textPreview: response.text?.substring(0, 100)
    });
    
    const finalText = response.text || response;
    if (!finalText || (typeof finalText === 'string' && finalText.trim().length === 0)) {
      console.warn('Empty transcription result');
      return '[No audio detected]';
    }

    return finalText;
  } catch (err) {
    console.log('=== TRANSCRIPTION ERROR ===');
    console.error('Transcription error details:', {
      message: err.message,
      status: err.status,
      statusCode: err.statusCode || err.code,
      type: err.type,
      headers: err.headers,
      errorBody: err.error,
    });

    // Provide more helpful error messages
    let errorMsg = err.message;
    if (err.status === 401 || err.message.includes('401')) {
      errorMsg = 'OpenAI authentication failed. Check your API key.';
    } else if (err.status === 429) {
      errorMsg = 'Rate limit exceeded. Please try again in a moment.';
    } else if (err.message.includes('timeout')) {
      errorMsg = 'Transcription request timed out. Please try again.';
    } else if (err.message.includes('network') || err.message.includes('ECONNREFUSED')) {
      errorMsg = 'Network error. Check your internet connection.';
    }

    throw new Error(`Failed to transcribe audio: ${errorMsg}`);
  }
};

// ─── Text to Speech (OpenAI TTS as fallback) ─────────────────────────────────
const generateSpeech = async (text, voice = 'alloy') => {
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice, // alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (err) {
    console.error('TTS error:', err);
    throw new Error('Text-to-speech failed: ' + err.message);
  }
};

// ─── Fallback Questions ───────────────────────────────────────────────────────
const getFallbackQuestions = (mode, difficulty, count) => {
  const allQuestions = {
    hr: [
      { text: 'Tell me about yourself and your professional journey.', type: 'general', category: 'Introduction' },
      { text: 'What are your greatest strengths and how have you applied them?', type: 'behavioral', category: 'Strengths' },
      { text: 'Describe a challenging situation at work and how you resolved it.', type: 'behavioral', category: 'Problem Solving' },
      { text: 'Where do you see yourself in 5 years?', type: 'hr', category: 'Career Goals' },
      { text: 'Why are you looking for a new opportunity?', type: 'hr', category: 'Motivation' },
    ],
    technical: [
      { text: 'Explain the concept of RESTful APIs and best practices.', type: 'technical', category: 'Web Development' },
      { text: 'What is the difference between SQL and NoSQL databases?', type: 'technical', category: 'Databases' },
      { text: 'Describe a complex technical problem you solved and your approach.', type: 'technical', category: 'Problem Solving' },
      { text: 'How do you ensure code quality in your projects?', type: 'technical', category: 'Best Practices' },
      { text: 'Explain the concept of microservices architecture.', type: 'technical', category: 'Architecture' },
    ],
    mixed: [
      { text: 'Tell me about yourself and what drives your passion for technology.', type: 'general', category: 'Introduction' },
      { text: 'Describe a technical challenge you overcame and what you learned.', type: 'behavioral', category: 'Learning' },
      { text: 'How do you stay updated with new technologies?', type: 'hr', category: 'Growth' },
      { text: 'Walk me through how you would design a URL shortening service.', type: 'technical', category: 'System Design' },
      { text: 'Tell me about a time you had to work under pressure to meet a deadline.', type: 'behavioral', category: 'Pressure' },
    ],
  };

  const questions = (allQuestions[mode] || allQuestions.mixed).slice(0, count);
  return questions.map(q => ({ ...q, difficulty, hint: 'Provide specific examples from your experience.' }));
};

module.exports = {
  generateQuestions,
  analyzeAnswer,
  generateSessionSummary,
  transcribeAudio,
  generateSpeech,
};
