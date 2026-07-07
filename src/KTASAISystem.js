import React, { useState, useRef } from 'react';
import './App.css';

function KTASAISystem({
  aiProvider = 'claude',
  aiApiKey,
  speechProvider = 'google',
  speechApiKey,
  ktasDatabase,
  onAssessmentComplete
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const recognitionRef = useRef(null);

  // KTAS 레벨 평가 로직
  const assessKTAS = (text) => {
    const lowerText = text.toLowerCase();
    const redFlags = (ktasDatabase.redFlags || []).filter(flag =>
      text.includes(flag) || lowerText.includes(flag.toLowerCase())
    );

    const matchedSymptoms = [];
    const symptoms = ktasDatabase.symptoms || {};
    Object.entries(symptoms).forEach(([category, symptomList]) => {
      symptomList.forEach(symptom => {
        if (text.includes(symptom)) {
          matchedSymptoms.push({ category, symptom });
        }
      });
    });

    let ktasLevel = 5;
    let confidence = 0.5;

    if (redFlags.length > 0) {
      ktasLevel = 1;
      confidence = 0.9;
    } else if (matchedSymptoms.some(s => ['호흡곤란', '흉통', '의식 변화', '경련', '마비'].includes(s.symptom))) {
      ktasLevel = 2;
      confidence = 0.8;
    } else if (matchedSymptoms.some(s => ['복통', '발열', '구토'].includes(s.symptom))) {
      ktasLevel = 3;
      confidence = 0.7;
    } else if (matchedSymptoms.length > 0) {
      ktasLevel = 4;
      confidence = 0.6;
    }

    const ktasInfo = (ktasDatabase.ktasLevels || []).find(k => k.level === ktasLevel) || {};

    const recommendations = generateRecommendations(ktasLevel, redFlags, matchedSymptoms);

    return {
      level: ktasLevel,
      confidence,
      symptoms: matchedSymptoms,
      redFlags,
      recommendations,
      ktasInfo
    };
  };

  const generateRecommendations = (level, redFlags, symptoms) => {
    const recs = [];
    if (level === 1) {
      recs.push('즉시 119 신고');
      recs.push('소생술 준비');
      recs.push('응급실 즉시 이송');
    } else if (level === 2) {
      recs.push('응급실 방문 권장');
      recs.push('10분 이내 의료진 진료');
    } else if (level === 3) {
      recs.push('응급실 진료 권장');
      recs.push('30분 이내 진료');
    } else if (level === 4) {
      recs.push('외래 진료 권장');
      recs.push('증상 악화 시 응급실 방문');
    } else {
      recs.push('집중 관찰');
      recs.push('증상 지속 시 외래 진료');
    }

    if (redFlags.length > 0) {
      recs.push(`⚠️ Red Flag: ${redFlags.join(', ')}`);
    }

    return recs;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    setIsAnalyzing(true);

    setTimeout(() => {
      const assessment = assessKTAS(input);
      setCurrentAssessment(assessment);

      const aiMessage = {
        role: 'assistant',
        text: `KTAS Level ${assessment.level}: ${assessment.ktasInfo.name || ''}\n${assessment.recommendations.join('\n')}`,
        timestamp: new Date().toISOString(),
        assessment
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsAnalyzing(false);

      if (onAssessmentComplete) {
        onAssessmentComplete(assessment);
      }
    }, 500);

    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('음성 인식이 지원되지 않는 브라우저입니다.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error('음성 인식 오류:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const getLevelColor = (level) => {
    const ktasLevel = (ktasDatabase.ktasLevels || []).find(k => k.level === level);
    return ktasLevel ? ktasLevel.color : '#6B7280';
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: '#1F2937', marginBottom: '20px' }}>
        🏥 KTAS AI 응급분류 시스템
      </h1>

      {/* 메시지 영역 */}
      <div style={{
        height: '400px',
        overflowY: 'auto',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '15px',
        backgroundColor: '#F9FAFB',
        marginBottom: '15px'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '150px' }}>
            환자의 증상을 입력하거나 음성으로 말해주세요.
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '10px'
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '10px 15px',
                borderRadius: '10px',
                backgroundColor: msg.role === 'user' ? '#3B82F6' : '#FFFFFF',
                color: msg.role === 'user' ? 'white' : '#1F2937',
                border: msg.role === 'user' ? 'none' : '1px solid #E5E7EB',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
                {msg.assessment && (
                  <div style={{
                    marginTop: '8px',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    backgroundColor: getLevelColor(msg.assessment.level),
                    color: 'white',
                    fontSize: '12px',
                    display: 'inline-block'
                  }}>
                    KTAS Level {msg.assessment.level} | 신뢰도 {(msg.assessment.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isAnalyzing && (
          <div style={{ textAlign: 'center', color: '#6B7280', padding: '10px' }}>
            ⏳ 분석 중...
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="증상을 입력하세요..."
          style={{
            flex: 1,
            padding: '12px 15px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#3B82F6',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          전송
        </button>
        <button
          onClick={isListening ? stopListening : startListening}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: isListening ? '#EF4444' : '#10B981',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {isListening ? '⏹️ 중지' : '🎤 음성'}
        </button>
      </div>

      {/* 현재 평가 결과 */}
      {currentAssessment && (
        <div style={{
          padding: '15px',
          borderRadius: '10px',
          backgroundColor: '#F3F4F6',
          border: `2px solid ${getLevelColor(currentAssessment.level)}`
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: getLevelColor(currentAssessment.level) }}>
            KTAS Level {currentAssessment.level}: {currentAssessment.ktasInfo.name || ''}
          </h3>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#4B5563' }}>
            <strong>응답 시간:</strong> {currentAssessment.ktasInfo.responseTime || '-'}
          </p>
          <p style={{ margin: '5px 0', fontSize: '14px', color: '#4B5563' }}>
            <strong>신뢰도:</strong> {(currentAssessment.confidence * 100).toFixed(0)}%
          </p>
          {currentAssessment.redFlags.length > 0 && (
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#DC2626' }}>
              <strong>⚠️ Red Flags:</strong> {currentAssessment.redFlags.join(', ')}
            </p>
          )}
          {currentAssessment.symptoms.length > 0 && (
            <p style={{ margin: '5px 0', fontSize: '14px', color: '#4B5563' }}>
              <strong>증상:</strong> {currentAssessment.symptoms.map(s => s.symptom).join(', ')}
            </p>
          )}
          <div style={{ marginTop: '10px' }}>
            <strong style={{ fontSize: '14px', color: '#4B5563' }}>권장 사항:</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '14px', color: '#4B5563' }}>
              {currentAssessment.recommendations.map((rec, idx) => (
                <li key={idx} style={{ marginBottom: '3px' }}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default KTASAISystem;
