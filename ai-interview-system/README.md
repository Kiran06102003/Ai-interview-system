# 🎤 AI Interview Pro

A full-stack AI-powered interview preparation system with **voice-first interaction**, real-time transcription, adaptive questioning, and deep analytics.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?logo=next.js) ![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js) ![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb) ![OpenAI](https://img.shields.io/badge/OpenAI-Whisper%20%7C%20GPT--4o-blue?logo=openai) ![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-black?logo=socket.io)

---

## ✨ Features

| Feature | Detail |
|---|---|
| 🎤 Voice-first | Whisper STT transcribes answers in real time |
| 📹 Webcam required | Interview blocked without camera access |
| 🤖 Adaptive AI | GPT-4o-mini generates role/skill-tailored questions |
| 🔊 Text-to-Speech | ElevenLabs (primary) / OpenAI TTS / Browser fallback |
| 📊 Live analytics | WPM, filler words, sentiment streamed via Socket.IO |
| 🏆 Scoring | Relevance · Clarity · Confidence · Structure (0–100) |
| 📈 Dashboard | Score history, radar charts, improvement trends |
| 🔐 Auth | JWT + bcrypt, secure sessions |
| 📄 Resume upload | Paste resume for personalized questions |
| 🌍 Multi-language | EN, ES, FR, DE, HI support |
| 3 Modes | HR · Technical · Mixed |
| 3 Difficulties | Easy · Medium · Hard |

---

## 🗂 Project Structure

```
ai-interview-system/
├── client/                        # Next.js 14 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── auth/login/        # Login
│   │   │   ├── auth/register/     # Registration (2-step)
│   │   │   ├── dashboard/         # Dashboard + history + analytics + profile
│   │   │   └── interview/
│   │   │       ├── setup/         # Interview configuration
│   │   │       ├── session/[id]/  # Live interview room
│   │   │       └── results/[id]/  # Post-interview results
│   │   ├── hooks/
│   │   │   ├── useMediaDevices.ts # Camera + mic + recording
│   │   │   └── useInterview.ts    # Socket.IO interview state
│   │   ├── lib/
│   │   │   ├── apiClient.ts       # Axios wrapper
│   │   │   └── socket.ts          # Socket.IO singleton
│   │   └── store/
│   │       └── authStore.ts       # Zustand auth state
│   └── package.json
│
├── server/                        # Node.js + Express backend
│   ├── index.js                   # Entry point (Express + Socket.IO)
│   ├── models/
│   │   ├── User.js                # User schema
│   │   └── Interview.js           # Interview + answers schema
│   ├── controllers/
│   │   ├── authController.js      # Register / login / profile
│   │   ├── interviewController.js # Start / answer / end
│   │   └── dashboardController.js # Analytics + history
│   ├── routes/
│   │   ├── auth.js
│   │   ├── interview.js
│   │   ├── dashboard.js
│   │   └── upload.js
│   ├── middleware/
│   │   ├── auth.js                # JWT middleware
│   │   └── errorHandler.js        # Global error handler
│   ├── sockets/
│   │   └── socketHandler.js       # All Socket.IO events
│   ├── ai-services/
│   │   ├── openaiService.js       # GPT-4o-mini + Whisper + TTS
│   │   └── ttsService.js          # ElevenLabs + OpenAI TTS
│   ├── utils/
│   │   └── speechAnalytics.js     # WPM + filler words + sentiment
│   └── tests/
│       └── api.test.js            # Jest + Supertest API tests
│
├── .env.example                   # Root env template
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- OpenAI API key (required)
- ElevenLabs API key (optional — falls back gracefully)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ai-interview-system.git
cd ai-interview-system

# Install root deps
npm install

# Install server deps
cd server && npm install && cd ..

# Install client deps
cd client && npm install && cd ..
```

### 2. Configure Environment

```bash
# Server environment
cp .env.example server/.env
# Edit server/.env — set MONGODB_URI, OPENAI_API_KEY, JWT_SECRET

# Client environment
cp client/.env.example client/.env.local
# Edit if your API runs on a different port
```

Minimum required in `server/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/ai-interview
OPENAI_API_KEY=sk-...
JWT_SECRET=any-long-random-string
```

### 3. Run Development Servers

```bash
# From project root — runs both client and server
npm run dev

# Or individually:
npm run dev:server   # http://localhost:5000
npm run dev:client   # http://localhost:3000
```

### 4. Run Tests

```bash
cd server
npm test
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login |
| GET | `/api/auth/profile` | ✅ | Get profile |
| PUT | `/api/auth/profile` | ✅ | Update profile |

### Interview
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/interview/start` | ✅ | Start session, get questions |
| POST | `/api/interview/answer` | ✅ | Submit text answer |
| POST | `/api/interview/answer/audio` | ✅ | Submit audio (Whisper STT) |
| POST | `/api/interview/end/:sessionId` | ✅ | End session + generate summary |
| GET | `/api/interview/session/:sessionId` | ✅ | Get session details |
| GET | `/api/interview/feedback/:sessionId` | ✅ | Get per-question feedback |

### Dashboard
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/data` | ✅ | Overview stats + charts |
| GET | `/api/dashboard/history` | ✅ | Paginated interview history |
| GET | `/api/dashboard/analytics` | ✅ | Deep performance analytics |

### Upload
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/upload/resume` | ✅ | Save resume text |
| POST | `/api/upload/tts` | ✅ | Generate TTS audio |

---

## 🔌 Socket.IO Events

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `start_interview` | `{ sessionId }` | Join room, receive first question |
| `request_question` | `{ sessionId, questionIndex }` | Request next question |
| `user_answer` | `{ sessionId, questionIndex, audioData, duration, textFallback }` | Submit audio answer |
| `live_metrics_update` | `{ partialTranscript, wordCount, duration }` | Stream live metrics |
| `end_interview` | `{ sessionId }` | End session |
| `rejoin_session` | `{ sessionId }` | Reconnect to dropped session |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `interview_ready` | `{ sessionId, totalQuestions, mode, difficulty }` | Session initialized |
| `new_question` | `{ questionIndex, question, type, difficulty, category, hint }` | Next question |
| `question_audio` | `{ audio, mimeType, provider }` | Base64 TTS audio |
| `use_browser_tts` | `{ text }` | Fallback: use Web Speech API |
| `live_transcript` | `{ text, questionIndex }` | Whisper transcript |
| `live_feedback` | `{ metrics, transcript }` | Real-time speech metrics |
| `transcribing` | `{ status }` | Processing status update |
| `analyzing` | `{ status }` | AI analysis status |
| `answer_analyzed` | `{ questionIndex, transcript, analysis, speechMetrics }` | Complete analysis |
| `interview_complete` | — | All questions done |
| `end_interview` | `{ overallScore, summary }` | Session ended |
| `error` | `{ message }` | Error notification |

---

## 🤖 AI Pipeline

For each answer:

```
Audio Blob (WebM/OGG)
        ↓
  Whisper STT API
        ↓
  Transcribed Text
        ↓
  Speech Analytics (local)
  ┌─ WPM calculation
  ├─ Filler word detection
  └─ Sentiment analysis
        ↓
  GPT-4o-mini Analysis
  ┌─ Relevance score (0-100)
  ├─ Clarity score (0-100)
  ├─ Structure score (0-100)
  ├─ Feedback paragraph
  ├─ Ideal answer outline
  ├─ Strengths list
  └─ Improvements list
        ↓
  Weighted Overall Score
  (Relevance 35% + Clarity 25% + Confidence 20% + Structure 20%)
        ↓
  Emitted via Socket.IO → Frontend
```

---

## 🛡 Security

- Passwords hashed with **bcrypt** (12 rounds)
- JWT tokens expire in **7 days** (configurable)
- Rate limiting: **100 requests / 15 min** per IP
- Helmet.js security headers
- CORS restricted to `CLIENT_URL`
- Audio uploads validated by MIME type (25MB max)
- MongoDB injection prevented by Mongoose schemas

---

## 🌍 Deployment

### Server (Railway / Render / EC2)
```bash
cd server
npm start
```
Set all env vars from `.env.example` in your host's dashboard.

### Client (Vercel)
```bash
cd client
npm run build
```
Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to your server URL.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| State | Zustand |
| Charts | Recharts |
| Real-time | Socket.IO client |
| Backend | Node.js, Express 4 |
| Database | MongoDB + Mongoose |
| Real-time | Socket.IO server |
| AI — NLP | OpenAI GPT-4o-mini |
| AI — STT | OpenAI Whisper |
| AI — TTS | ElevenLabs (primary) / OpenAI TTS (fallback) |
| Auth | JWT + bcrypt |
| Testing | Jest + Supertest |

---

## 📄 License

MIT — free for personal and commercial use.
