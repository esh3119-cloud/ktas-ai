const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const dbPath = path.join(__dirname, 'ktas-data.json');

function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  }
  return {
    sessions: [],
    messages: [],
    assessments: [],
    feedback: [],
    speechAnalysis: [],
    aiAnalysis: [],
    trainingData: []
  };
}

function saveData(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ 데이터 저장됨');
  } catch (error) {
    console.error('데이터 저장 오류:', error);
  }
}

let db = loadData();

app.post('/api/session/start', (req, res) => {
  const { userId, userRole } = req.body;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  db.sessions.push({
    id: db.sessions.length + 1,
    sessionId,
    userId,
    userRole,
    startTime: new Date().toISOString(),
    endTime: null
  });
  
  saveData(db);
  
  res.json({
    success: true,
    sessionId,
    message: '세션 시작'
  });
});

app.post('/api/message/save', (req, res) => {
  const {
    sessionId,
    userRole,
    message,
    speechProvider,
    speechConfidence,
    aiProvider,
    aiModel
  } = req.body;

  db.messages.push({
    id: db.messages.length + 1,
    sessionId,
    userRole,
    message,
    timestamp: new Date().toISOString(),
    speechProvider,
    speechConfidence,
    aiProvider,
    aiModel
  });

  saveData(db);

  res.json({
    success: true,
    message: '메시지 저장됨'
  });
});

app.post('/api/assessment/save', (req, res) => {
  const {
    sessionId,
    messageId,
    ktasLevel,
    confidence,
    symptoms,
    redFlags,
    recommendations
  } = req.body;

  db.assessments.push({
    id: db.assessments.length + 1,
    sessionId,
    messageId,
    ktasLevel,
    confidence,
    symptoms,
    redFlags,
    recommendations,
    timestamp: new Date().toISOString()
  });

  saveData(db);

  res.json({
    success: true,
    message: 'KTAS 평가 저장됨'
  });
});

app.post('/api/feedback/save', (req, res) => {
  const {
    assessmentId,
    userFeedback,
    actualKTASLevel,
    isCorrect
  } = req.body;

  db.feedback.push({
    id: db.feedback.length + 1,
    assessmentId,
    userFeedback,
    actualKTASLevel,
    isCorrect,
    timestamp: new Date().toISOString()
  });

  saveData(db);

  res.json({
    success: true,
    message: '피드백 저장됨',
    learningUpdate: !isCorrect ? 'AI 모델이 학습합니다' : null
  });
});

app.post('/api/speech/analyze', (req, res) => {
  const {
    sessionId,
    transcript,
    recognizedRole,
    speechSpeed,
    confidenceScore,
    medicalTermCount,
    emotionalIndicators
  } = req.body;

  db.speechAnalysis.push({
    id: db.speechAnalysis.length + 1,
    sessionId,
    transcript,
    recognizedRole,
    speechSpeed,
    confidenceScore,
    medicalTermCount,
    emotionalIndicators,
    timestamp: new Date().toISOString()
  });

  saveData(db);

  res.json({
    success: true,
    message: '음성 분석 저장됨'
  });
});

app.post('/api/ai/analyze', (req, res) => {
  const {
    messageId,
    aiProvider,
    responseTime,
    responseQuality,
    tokenUsage,
    cost
  } = req.body;

  db.aiAnalysis.push({
    id: db.aiAnalysis.length + 1,
    messageId,
    aiProvider,
    responseTime,
    responseQuality,
    tokenUsage,
    cost,
    timestamp: new Date().toISOString()
  });

  saveData(db);

  res.json({
    success: true,
    message: 'AI 분석 저장됨'
  });
});

app.post('/api/session/end', (req, res) => {
  const { sessionId } = req.body;

  const session = db.sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.endTime = new Date().toISOString();
    saveData(db);
  }

  res.json({
    success: true,
    message: '세션 종료됨'
  });
});

app.get('/api/stats/daily', (req, res) => {
  const stats = {};
  
  db.assessments.forEach(assessment => {
    const date = assessment.timestamp.split('T')[0];
    if (!stats[date]) {
      stats[date] = {
        date,
        totalAssessments: 0,
        avgConfidence: 0,
        uniqueSessions: new Set()
      };
    }
    stats[date].totalAssessments++;
    stats[date].avgConfidence += assessment.confidence;
    stats[date].uniqueSessions.add(assessment.sessionId);
  });

  const result = Object.values(stats).map(s => ({
    date: s.date,
    totalAssessments: s.totalAssessments,
    avgConfidence: (s.avgConfidence / s.totalAssessments).toFixed(2),
    uniqueSessions: s.uniqueSessions.size
  }));

  res.json(result.reverse());
});

app.get('/api/stats/ktasDistribution', (req, res) => {
  const distribution = {};
  
  db.assessments.forEach(assessment => {
    const level = assessment.ktasLevel;
    distribution[level] = (distribution[level] || 0) + 1;
  });

  const total = db.assessments.length;
  const result = Object.entries(distribution).map(([level, count]) => ({
    ktasLevel: parseInt(level),
    count,
    percentage: total > 0 ? (count / total * 100).toFixed(2) : 0
  }));

  res.json(result.sort((a, b) => a.ktasLevel - b.ktasLevel));
});

app.get('/api/stats/accuracy', (req, res) => {
  const stats = {};
  
  db.feedback.forEach(f => {
    const date = f.timestamp.split('T')[0];
    if (!stats[date]) {
      stats[date] = { totalFeedback: 0, correctCount: 0 };
    }
    stats[date].totalFeedback++;
    if (f.isCorrect) stats[date].correctCount++;
  });

  const result = Object.entries(stats).map(([date, s]) => ({
    date,
    totalFeedback: s.totalFeedback,
    correctCount: s.correctCount,
    accuracy: (s.correctCount / s.totalFeedback * 100).toFixed(2)
  }));

  res.json(result.reverse().slice(0, 30));
});

app.get('/api/learning-status', (req, res) => {
  res.json({
    isLearning: false,
    lastUpdate: new Date(),
    accuracy: 0.85,
    totalTrainingData: db.trainingData.length,
    approvedData: 0,
    avgQuality: 0
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'active',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════╗
  ║  🚀 KTAS AI 백엔드 서버 시작!     ║
  ║  📍 http://localhost:${PORT}       ║
  ║  💾 데이터: ./ktas-data.json       ║
  ╚════════════════════════════════════╝
  `);
});

module.exports = app;