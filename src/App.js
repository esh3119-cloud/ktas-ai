import React, { useEffect, useState } from 'react';
import KTASAISystem from './KTASAISystem';
import ktasDatabase from './ktas_database.json';

class BackendIntegration {
  constructor(backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000') {
    this.backendUrl = backendUrl;
    this.sessionId = this.generateSessionId();
    this.messageBuffer = [];
    this.isOnline = false;
    
    this.checkConnection();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.backendUrl}/health`);
      this.isOnline = response.ok;
      console.log(this.isOnline ? '✅ 백엔드 연결됨' : '⚠️ 로컬 모드');
      return this.isOnline;
    } catch (error) {
      this.isOnline = false;
      console.log('📝 로컬 모드로 실행');
      return false;
    }
  }

  async startSession(userId = null, userRole = 'patient') {
    if (!this.isOnline) return { sessionId: this.sessionId, offline: true };

    try {
      const response = await fetch(`${this.backendUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userRole })
      });
      const data = await response.json();
      if (data.success) this.sessionId = data.sessionId;
      return data;
    } catch (error) {
      return { error: error.message };
    }
  }

  async saveAssessment(messageId, ktasLevel, confidence, symptoms, redFlags, recommendations) {
    const data = {
      sessionId: this.sessionId,
      messageId,
      ktasLevel,
      confidence,
      symptoms,
      redFlags,
      recommendations
    };

    if (!this.isOnline) return { buffered: true };

    try {
      const response = await fetch(`${this.backendUrl}/api/assessment/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { error: error.message, buffered: true };
    }
  }

  async saveFeedback(assessmentId, userFeedback, actualKTASLevel, isCorrect) {
    const data = { assessmentId, userFeedback, actualKTASLevel, isCorrect };

    if (!this.isOnline) return { buffered: true };

    try {
      const response = await fetch(`${this.backendUrl}/api/feedback/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  async endSession() {
    if (!this.isOnline) return { offline: true };

    try {
      const response = await fetch(`${this.backendUrl}/api/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }
}

function App() {
  const [backend, setBackend] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const backendIntegration = new BackendIntegration(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');
    setBackend(backendIntegration);

    backendIntegration.checkConnection().then(connected => {
      setIsConnected(connected);
    });

    backendIntegration.startSession(`user_${Date.now()}`, 'patient');

    return () => {
      backendIntegration.endSession();
    };
  }, []);

  const handleAssessmentComplete = async (assessment) => {
    if (backend) {
      try {
        await backend.saveAssessment(
          null,
          assessment.level,
          assessment.confidence,
          assessment.symptoms,
          assessment.redFlags,
          assessment.recommendations
        );
        console.log('✅ 데이터 저장됨');
      } catch (error) {
        console.error('저장 오류:', error);
      }
    }
  };

  return (
    <div>
      {isConnected ? (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px 15px',
          backgroundColor: '#22C55E',
          color: 'white',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          ✅ 서버 연결됨
        </div>
      ) : (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px 15px',
          backgroundColor: '#FCA5A5',
          color: 'white',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 9999
        }}>
          📝 로컬 모드
        </div>
      )}

      <KTASAISystem
        aiProvider="claude"
        aiApiKey={process.env.REACT_APP_CLAUDE_API_KEY}
        speechProvider="google"
        speechApiKey={process.env.REACT_APP_SPEECH_API_KEY}
        ktasDatabase={ktasDatabase}
        onAssessmentComplete={handleAssessmentComplete}
      />
    </div>
  );
}

export default App;