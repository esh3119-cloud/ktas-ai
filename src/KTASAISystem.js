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
  const [assessmentSteps, setAssessmentSteps] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: 입력, 1: 질문진행, 2: 결과
  const [questionQueue, setQuestionQueue] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [tempAnswers, setTempAnswers] = useState({});
  const recognitionRef = useRef(null);

  // KTAS 색상
  const getLevelColor = (level) => {
    const colors = {
      1: '#FF0000', // 빨강 (소생)
      2: '#FF4444', // 주홍 (긴급)
      3: '#FF8800', // 주황 (응급)
      4: '#FFBB00', // 노랑 (준응급)
      5: '#00AA00', // 초록 (비응급)
    };
    return colors[level] || '#6B7280';
  };

  // KTAS 평가 로직 - 단계별 추적 포함
  const assessKTAS = (text, answers = {}) => {
    const lowerText = text.toLowerCase();
    const steps = [];

    // Step 1: 증상 입력 분석
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
    let ktasRange = '4-5';

    steps.push({
      stepNumber: 1,
      type: 'input',
      title: '증상 입력',
      content: text,
      analysis: {
        matchedSymptoms: matchedSymptoms.map(s => `${s.symptom} (${s.category})`),
        redFlags: redFlags,
        symptomCategory: matchedSymptoms.length > 0 ? matchedSymptoms[0].category : '기타',
      },
      impact: {
        beforeKTAS: '미정',
        afterKTAS: '',
        reason: '',
      },
    });

    // Red Flag 확인
    if (redFlags.length > 0) {
      ktasLevel = 1;
      confidence = 0.9;
      ktasRange = '1';
      steps[0].impact.afterKTAS = '1';
      steps[0].impact.reason = `Red Flag 발견: ${redFlags.join(', ')}`;
    } else if (matchedSymptoms.some(s => ['호흡곤란', '흉통', '의식 변화', '경련', '마비'].includes(s.symptom))) {
      ktasLevel = 2;
      confidence = 0.7;
      ktasRange = '2-3';
      steps[0].impact.afterKTAS = '2-3';
      steps[0].impact.reason = `긴급 증상 감지: ${matchedSymptoms.filter(s => ['호흡곤란', '흉통', '의식 변화', '경련', '마비'].includes(s.symptom)).map(s => s.symptom).join(', ')}`;
    } else if (matchedSymptoms.some(s => ['복통', '발열', '구토'].includes(s.symptom))) {
      ktasLevel = 3;
      confidence = 0.6;
      ktasRange = '3-4';
      steps[0].impact.afterKTAS = '3-4';
      steps[0].impact.reason = `응급 증상 감지: ${matchedSymptoms.filter(s => ['복통', '발열', '구토'].includes(s.symptom)).map(s => s.symptom).join(', ')}`;
    } else if (matchedSymptoms.length > 0) {
      ktasLevel = 4;
      confidence = 0.55;
      ktasRange = '4-5';
      steps[0].impact.afterKTAS = '4-5';
      steps[0].impact.reason = `일반 증상 감지: ${matchedSymptoms.map(s => s.symptom).join(', ')}`;
    } else {
      steps[0].impact.afterKTAS = '5';
      steps[0].impact.reason = '명확한 증상 미감지, 추가 질문 필요';
    }

    // Step 2: 추가 질문에 따른 KTAS 조정
    const questionImpacts = [];

    // 의식 수준 질문
    if (answers.consciousness) {
      const before = ktasRange;
      if (answers.consciousness === '무의식') {
        ktasLevel = 1;
        confidence = Math.min(confidence + 0.1, 0.95);
        ktasRange = '1';
        questionImpacts.push({
          question: '의식 수준',
          answer: '무의식 (U, GCS 3-8)',
          beforeKTAS: before,
          afterKTAS: '1',
          reason: '무의식 상태 - 즉시 소생술 필요',
          necessity: '★★★',
        });
      } else if (answers.consciousness === '의식변화') {
        ktasLevel = Math.min(ktasLevel, 2);
        confidence = Math.min(confidence + 0.08, 0.9);
        ktasRange = '2';
        questionImpacts.push({
          question: '의식 수준',
          answer: '의식변화 (V/P, GCS 9-13)',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '의식 변화 - 긴급 처치 필요',
          necessity: '★★★',
        });
      } else {
        questionImpacts.push({
          question: '의식 수준',
          answer: '정상 (GCS 15)',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '의식 정상 - 상향 없음',
          necessity: '★★★',
        });
      }
    }

    // 혈역학적 상태 질문
    if (answers.hemodynamics) {
      const before = ktasRange;
      if (answers.hemodynamics === '쇼크') {
        ktasLevel = 1;
        confidence = Math.min(confidence + 0.1, 0.95);
        ktasRange = '1';
        questionImpacts.push({
          question: '혈역학적 상태',
          answer: '쇼크',
          beforeKTAS: before,
          afterKTAS: '1',
          reason: '쇼크 상태 - 즉시 소생술 필요',
          necessity: '★★★',
        });
      } else if (answers.hemodynamics === '혈역학적 장애') {
        ktasLevel = Math.min(ktasLevel, 2);
        confidence = Math.min(confidence + 0.08, 0.9);
        ktasRange = '2';
        questionImpacts.push({
          question: '혈역학적 상태',
          answer: '혈역학적 장애',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '혈역학적 장애 - 긴급 처치 필요',
          necessity: '★★★',
        });
      } else {
        questionImpacts.push({
          question: '혈역학적 상태',
          answer: '안정',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '혈역학적 안정 - 상향 없음',
          necessity: '★★★',
        });
      }
    }

    // 호흡 상태 질문
    if (answers.respiration) {
      const before = ktasRange;
      if (answers.respiration === '중증 호흡곤란') {
        ktasLevel = Math.min(ktasLevel, 1);
        confidence = Math.min(confidence + 0.1, 0.95);
        ktasRange = '1';
        questionImpacts.push({
          question: '호흡 상태',
          answer: '중증 호흡곤란',
          beforeKTAS: before,
          afterKTAS: '1',
          reason: '중증 호흡곤란 - 즉시 기도 확보 필요',
          necessity: '★★★',
        });
      } else if (answers.respiration === '중등도 호흡곤란') {
        ktasLevel = Math.min(ktasLevel, 3);
        confidence = Math.min(confidence + 0.05, 0.85);
        ktasRange = ktasRange === '1' || ktasRange === '2' ? ktasRange : '3';
        questionImpacts.push({
          question: '호흡 상태',
          answer: '중등도 호흡곤란',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '중등도 호흡곤란 - 응급실 진료 필요',
          necessity: '★★★',
        });
      } else if (answers.respiration === '경증 호흡곤란') {
        ktasLevel = Math.min(ktasLevel, 4);
        questionImpacts.push({
          question: '호흡 상태',
          answer: '경증 호흡곤란',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '경증 호흡곤란 - 준응급 진료',
          necessity: '★★',
        });
      } else {
        questionImpacts.push({
          question: '호흡 상태',
          answer: '정상',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '호흡 정상 - 상향 없음',
          necessity: '★★★',
        });
      }
    }

    // 체온 질문
    if (answers.fever) {
      const before = ktasRange;
      if (answers.fever === '고열+면역저하') {
        ktasLevel = Math.min(ktasLevel, 2);
        confidence = Math.min(confidence + 0.05, 0.85);
        questionImpacts.push({
          question: '체온 상태',
          answer: '고열 + 면역저하 상태',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '면역저하 환자의 발열 - 패혈증 위험',
          necessity: '★★★',
        });
      } else if (answers.fever === '패혈증의증') {
        ktasLevel = Math.min(ktasLevel, 2);
        questionImpacts.push({
          question: '체온 상태',
          answer: '패혈증 의증 (3개 이상 SIRS 기준)',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '패혈증 의증 - 긴급 처치 필요',
          necessity: '★★★',
        });
      } else if (answers.fever === 'SIRS') {
        ktasLevel = Math.min(ktasLevel, 3);
        questionImpacts.push({
          question: '체온 상태',
          answer: '전신염증반응증후군 (SIRS)',
          beforeKTAS: before,
          afterKTAS: '3',
          reason: 'SIRS - 응급실 진료 필요',
          necessity: '★★',
        });
      } else if (answers.fever === '열(아파보임)') {
        ktasLevel = Math.min(ktasLevel, 3);
        questionImpacts.push({
          question: '체온 상태',
          answer: '열 (아파 보임)',
          beforeKTAS: before,
          afterKTAS: '3',
          reason: '발열 + 전신 상태 불량 - 응급 진료',
          necessity: '★★',
        });
      } else {
        questionImpacts.push({
          question: '체온 상태',
          answer: '열 (건강해 보임)',
          beforeKTAS: before,
          afterKTAS: '4',
          reason: '발열만 있으나 전신 상태 양호',
          necessity: '★',
        });
      }
    }

    // 출혈 질문
    if (answers.bleeding) {
      const before = ktasRange;
      if (answers.bleeding === '위급한출혈') {
        ktasLevel = Math.min(ktasLevel, 2);
        confidence = Math.min(confidence + 0.08, 0.9);
        questionImpacts.push({
          question: '출혈성 질환',
          answer: '생명/사지 소실 정도의 위급한 출혈',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '위급한 출혈 - 즉시 지혈 필요',
          necessity: '★★★',
        });
      } else if (answers.bleeding === '일반출혈') {
        ktasLevel = Math.min(ktasLevel, 3);
        questionImpacts.push({
          question: '출혈성 질환',
          answer: '지혈이 필요한 출혈',
          beforeKTAS: before,
          afterKTAS: '3',
          reason: '일반 출혈 - 응급실 진료',
          necessity: '★★',
        });
      }
    }

    // 방사통 질문 (흉통 관련)
    if (answers.radiatingPain !== undefined) {
      const before = ktasRange;
      if (answers.radiatingPain === true) {
        ktasLevel = Math.min(ktasLevel, 2);
        confidence = Math.min(confidence + 0.05, 0.9);
        questionImpacts.push({
          question: '방사통 여부',
          answer: '예 (팔/목/턱로 방사)',
          beforeKTAS: before,
          afterKTAS: '2',
          reason: '방사통 - 심근경색 가능성 높음',
          necessity: '★★★',
        });
      } else {
        questionImpacts.push({
          question: '방사통 여부',
          answer: '아니오',
          beforeKTAS: before,
          afterKTAS: ktasRange,
          reason: '방사통 없음 - 심근경색 가능성 감소',
          necessity: '★★',
        });
      }
    }

    // 발생 시간 질문
    if (answers.onsetTime) {
      const before = ktasRange;
      const isAcute = answers.onsetTime.includes('시간') && parseInt(answers.onsetTime) <= 6;
      questionImpacts.push({
        question: '증상 발생 시점',
        answer: answers.onsetTime,
        beforeKTAS: before,
        afterKTAS: ktasRange,
        reason: isAcute ? '급성 발병 - 응급도 높음' : '만성/지연성 발병',
        necessity: '★★',
      });
    }

    // Step 2 추가
    if (questionImpacts.length > 0) {
      steps.push({
        stepNumber: 2,
        type: 'questions',
        title: '추가 질문 및 답변',
        questions: questionImpacts,
        impact: {
          beforeKTAS: steps[0].impact.afterKTAS,
          afterKTAS: ktasRange,
          reason: `${questionImpacts.length}개 질문을 통한 KTAS 조정`,
        },
      });
    }

    // Step 3: 최종 판정
    const ktasInfo = (ktasDatabase.ktasLevels || []).find(k => k.level === ktasLevel) || {};
    const recommendations = generateRecommendations(ktasLevel, redFlags, matchedSymptoms);

    // 확정 사유 정리
    const finalReasons = [];
    if (redFlags.length > 0) finalReasons.push(`Red Flag: ${redFlags.join(', ')}`);
    if (answers.consciousness === '무의식') finalReasons.push('무의식 상태');
    if (answers.consciousness === '의식변화') finalReasons.push('의식 변화');
    if (answers.hemodynamics === '쇼크') finalReasons.push('쇼크');
    if (answers.respiration === '중증 호흡곤란') finalReasons.push('중증 호흡곤란');
    if (answers.radiatingPain === true) finalReasons.push('방사통 (심근경색 의심)');
    if (matchedSymptoms.some(s => ['흉통', '호흡곤란'].includes(s.symptom))) finalReasons.push(`급성 ${matchedSymptoms.filter(s => ['흉통', '호흡곤란'].includes(s.symptom)).map(s => s.symptom).join(', ')}`);
    if (finalReasons.length === 0) finalReasons.push(matchedSymptoms.length > 0 ? `증상 기반 분류: ${matchedSymptoms.map(s => s.symptom).join(', ')}` : '명확한 응급 소견 없음');

    steps.push({
      stepNumber: 3,
      type: 'result',
      title: '최종 판정',
      finalKTAS: ktasLevel,
      finalConfidence: confidence,
      finalReasons: finalReasons,
      ktasInfo: ktasInfo,
      recommendations: recommendations,
      impact: {
        beforeKTAS: ktasRange,
        afterKTAS: String(ktasLevel),
        reason: finalReasons.join('\n'),
      },
    });

    // Step 4: 응급 처치 가이드
    const emergencyCare = generateEmergencyCare(ktasLevel);
    steps.push({
      stepNumber: 4,
      type: 'emergency_care',
      title: '응급 처치 가이드',
      care: emergencyCare,
    });

    return {
      level: ktasLevel,
      confidence,
      symptoms: matchedSymptoms,
      redFlags,
      recommendations,
      ktasInfo,
      steps,
    };
  };

  const generateRecommendations = (level, redFlags, symptoms) => {
    const recs = [];
    if (level === 1) {
      recs.push('즉시 119 신고');
      recs.push('소생술 준비 (CPR)');
      recs.push('응급실 즉시 이송');
      recs.push('기도 확보 및 산소 투여');
    } else if (level === 2) {
      recs.push('응급실 방문 권장');
      recs.push('10분 이내 의료진 진료');
      recs.push('IV 라인 확보');
      recs.push('활력징후 지속 모니터링');
    } else if (level === 3) {
      recs.push('응급실 진료 권장');
      recs.push('30분 이내 진료');
      recs.push('증상 변화 시 즉시 의료진 호출');
    } else if (level === 4) {
      recs.push('외래 진료 권장');
      recs.push('60분 이내 진료');
      recs.push('증상 악화 시 응급실 방문');
    } else {
      recs.push('집중 관찰');
      recs.push('증상 지속 시 외래 진료');
      recs.push('건강 상담 권장');
    }

    if (redFlags.length > 0) {
      recs.push(`⚠️ Red Flag: ${redFlags.join(', ')}`);
    }

    return recs;
  };

  const generateEmergencyCare = (level) => {
    const care = {
      required: [],
      recommended: [],
      prohibited: [],
      nextStep: '',
    };

    if (level === 1) {
      care.required = ['CPR (심폐소생술)', '기도 확보', '산소 투여 (고유량)', 'IV 라인 확보', '제세동기 준비'];
      care.recommended = ['혈액검사 (응급)', '동맥혈 가스 분석', '흉부 X선'];
      care.prohibited = ['식사/음수 금지', '환자 이동 최소화'];
      care.nextStep = '→ 응급실 즉시 이송, 소생팀 호출';
    } else if (level === 2) {
      care.required = ['심전도 검사 (즉시)', 'IV 라인 확보', '혈압/맥박/산소포화도 측정', '산소 투여 (필요시)'];
      care.recommended = ['혈청 트로포닌 검사', '흉부 X선', '혈액 검사'];
      care.prohibited = ['식사/음수 금지', '무리한 활동 금지'];
      care.nextStep = '→ 응급실 즉시 이송 준비, 10분 내 의사 진찰';
    } else if (level === 3) {
      care.required = ['활력징후 측정', '기본 병력 청취'];
      care.recommended = ['혈액 검사', 'X선 검사', '심전도 (흉통 시)'];
      care.prohibited = [];
      care.nextStep = '→ 30분 내 응급실 진료';
    } else if (level === 4) {
      care.required = ['활력징후 측정'];
      care.recommended = ['외래 진료 예약'];
      care.prohibited = [];
      care.nextStep = '→ 60분 내 외래 진료, 악화 시 응급실';
    } else {
      care.required = ['활력징후 측정'];
      care.recommended = ['집중 관찰', '건강 상담'];
      care.prohibited = [];
      care.nextStep = '→ 외래 진료 예약, 증상 지속 시 재방문';
    }

    return care;
  };

  // 증상에 따른 추가 질문 생성
  const generateQuestions = (text, matchedSymptoms) => {
    const questions = [];

    // 흉통 관련 질문
    if (text.includes('흉통') || text.includes('가슴') || matchedSymptoms.some(s => s.symptom === '흉통')) {
      questions.push({
        id: 'radiatingPain',
        question: '방사통(팔/목/턱로 퍼지는 통증)이 있는가?',
        type: 'boolean',
        necessity: '★★★',
        reason: '심근경색 감별에 필수',
      });
    }

    // 의식 수준 질문
    questions.push({
      id: 'consciousness',
      question: '환자의 의식 수준은?',
      type: 'choice',
      options: ['정상', '의식변화', '무의식'],
      necessity: '★★★',
      reason: 'KTAS 분류의 핵심 지표',
    });

    // 혈역학적 상태 질문
    questions.push({
      id: 'hemodynamics',
      question: '혈역학적 상태는?',
      type: 'choice',
      options: ['안정', '혈역학적 장애', '쇼크'],
      necessity: '★★★',
      reason: '쇼크 여부 확인',
    });

    // 호흡 상태 질문
    if (text.includes('호흡') || matchedSymptoms.some(s => s.category === 'respiratory')) {
      questions.push({
        id: 'respiration',
        question: '호흡 상태는?',
        type: 'choice',
        options: ['정상', '경증 호흡곤란', '중등도 호흡곤란', '중증 호흡곤란'],
        necessity: '★★★',
        reason: '호흡곤란 정도에 따른 KTAS 조정',
      });
    }

    // 체온 질문
    if (text.includes('발열') || text.includes('열') || matchedSymptoms.some(s => s.symptom === '발열')) {
      questions.push({
        id: 'fever',
        question: '체온 상태는?',
        type: 'choice',
        options: ['열(건강해보임)', '열(아파보임)', 'SIRS', '패혈증의증', '고열+면역저하'],
        necessity: '★★',
        reason: '발열 + 전신 상태에 따른 KTAS 조정',
      });
    }

    // 출혈 질문
    if (text.includes('출혈') || text.includes('피') || matchedSymptoms.some(s => s.symptom === '출혈')) {
      questions.push({
        id: 'bleeding',
        question: '출혈 상태는?',
        type: 'choice',
        options: ['일반출혈', '위급한출혈'],
        necessity: '★★★',
        reason: '출혈 정도에 따른 KTAS 조정',
      });
    }

    // 발생 시간 질문
    questions.push({
      id: 'onsetTime',
      question: '증상은 언제부터 시작되었나요?',
      type: 'text',
      necessity: '★★',
      reason: '급성 vs 만성 판단',
    });

    return questions;
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    setIsAnalyzing(true);

    setTimeout(() => {
      // 초기 증상 매칭
      const matchedSymptoms = [];

      const symptoms = ktasDatabase.symptoms || {};
      Object.entries(symptoms).forEach(([category, symptomList]) => {
        symptomList.forEach(symptom => {
          if (input.includes(symptom)) {
            matchedSymptoms.push({ category, symptom });
          }
        });
      });

      // 추가 질문 생성
      const questions = generateQuestions(input, matchedSymptoms);

      if (questions.length > 0) {
        setQuestionQueue(questions);
        setCurrentStep(1);
        setCurrentQuestion(questions[0]);
        setTempAnswers({});

        const aiMessage = {
          role: 'assistant',
          text: `증상을 분석했습니다. 정확한 KTAS 등급을 위해 ${questions.length}개의 추가 질문을 드리겠습니다.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // 질문 없이 바로 평가
        const assessment = assessKTAS(input, {});
        finalizeAssessment(assessment);
      }

      setIsAnalyzing(false);
    }, 500);

    setInput('');
  };

  const handleAnswer = (answer) => {
    const newAnswers = { ...tempAnswers, [currentQuestion.id]: answer };
    setTempAnswers(newAnswers);

    const answerText = typeof answer === 'boolean' ? (answer ? '예' : '아니오') : answer;
    const userMessage = { role: 'user', text: answerText, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);

    const nextIndex = questionQueue.findIndex(q => q.id === currentQuestion.id) + 1;

    if (nextIndex < questionQueue.length) {
      setCurrentQuestion(questionQueue[nextIndex]);
      const aiMessage = {
        role: 'assistant',
        text: questionQueue[nextIndex].question,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } else {
      // 모든 질문 완료 - 최종 평가
      const assessment = assessKTAS(input, newAnswers);
      finalizeAssessment(assessment);
    }
  };

  const finalizeAssessment = (assessment) => {
    setCurrentAssessment(assessment);
    setAssessmentSteps(assessment.steps || []);
    setCurrentStep(2);

    const aiMessage = {
      role: 'assistant',
      text: `✅ KTAS Level ${assessment.level}: ${assessment.ktasInfo.name || ''}\n신뢰도: ${(assessment.confidence * 100).toFixed(0)}%\n\n${assessment.recommendations.join('\n')}`,
      timestamp: new Date().toISOString(),
      assessment,
    };
    setMessages(prev => [...prev, aiMessage]);

    if (onAssessmentComplete) {
      onAssessmentComplete(assessment);
    }
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

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => setInput(event.results[0][0].transcript);
    recognition.onerror = (event) => { console.error('음성 인식 오류:', event.error); setIsListening(false); };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
  };

  const resetAssessment = () => {
    setMessages([]);
    setCurrentAssessment(null);
    setAssessmentSteps([]);
    setCurrentStep(0);
    setQuestionQueue([]);
    setCurrentQuestion(null);
    setTempAnswers({});
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: '#1F2937', marginBottom: '20px' }}>
        🏥 KTAS AI 응급분류 시스템
      </h1>

      {/* 메시지 영역 */}
      <div style={{
        height: '350px',
        overflowY: 'auto',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '15px',
        backgroundColor: '#F9FAFB',
        marginBottom: '15px',
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '130px' }}>
            환자의 증상을 입력하거나 음성으로 말해주세요.
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '10px',
            }}>
              <div style={{
                maxWidth: '70%',
                padding: '10px 15px',
                borderRadius: '10px',
                backgroundColor: msg.role === 'user' ? '#3B82F6' : '#FFFFFF',
                color: msg.role === 'user' ? 'white' : '#1F2937',
                border: msg.role === 'user' ? 'none' : '1px solid #E5E7EB',
                whiteSpace: 'pre-wrap',
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
                    display: 'inline-block',
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
      {currentStep === 0 && (
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
              outline: 'none',
            }}
          />
          <button onClick={handleSend} style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
            전송
          </button>
          <button onClick={isListening ? stopListening : startListening} style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', backgroundColor: isListening ? '#EF4444' : '#10B981', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
            {isListening ? '⏹️ 중지' : '🎤 음성'}
          </button>
        </div>
      )}

      {/* 추가 질문 영역 */}
      {currentStep === 1 && currentQuestion && (
        <div style={{
          padding: '15px',
          borderRadius: '10px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E40AF' }}>
              질문 {questionQueue.findIndex(q => q.id === currentQuestion.id) + 1}/{questionQueue.length}
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>필요도: {currentQuestion.necessity}</span>
          </div>
          <p style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#1F2937', fontWeight: 'bold' }}>
            {currentQuestion.question}
          </p>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#6B7280' }}>
            💡 {currentQuestion.reason}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {currentQuestion.type === 'boolean' && (
              <>
                <button onClick={() => handleAnswer(true)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: '13px' }}>예</button>
                <button onClick={() => handleAnswer(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#6B7280', color: 'white', cursor: 'pointer', fontSize: '13px' }}>아니오</button>
              </>
            )}
            {currentQuestion.type === 'choice' && currentQuestion.options?.map(opt => (
              <button key={opt} onClick={() => handleAnswer(opt)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', color: '#1F2937', cursor: 'pointer', fontSize: '13px' }}>
                {opt}
              </button>
            ))}
            {currentQuestion.type === 'text' && (
              <input
                type="text"
                placeholder="답변 입력..."
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) handleAnswer(e.target.value); }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px' }}
                autoFocus
              />
            )}
          </div>
        </div>
      )}

      {/* 평가 과정 추적 결과 */}
      {currentStep === 2 && assessmentSteps.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          {/* 타임라인 헤더 */}
          <div style={{
            padding: '12px 15px',
            borderRadius: '10px 10px 0 0',
            backgroundColor: getLevelColor(currentAssessment.level),
            color: 'white',
            fontWeight: 'bold',
            fontSize: '16px',
            textAlign: 'center',
          }}>
            📋 KTAS 평가 과정 추적
          </div>

          {/* 각 Step 표시 */}
          {assessmentSteps.map((step, idx) => (
            <div key={idx} style={{
              padding: '15px',
              border: '1px solid #E5E7EB',
              borderTop: idx === 0 ? 'none' : '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
            }}>
              {/* Step 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#3B82F6',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                }}>
                  {step.stepNumber}
                </div>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1F2937' }}>
                  {step.title}
                </span>
              </div>

              {/* Step 1: 증상 입력 */}
              {step.type === 'input' && (
                <div style={{ paddingLeft: '36px', fontSize: '13px', color: '#4B5563' }}>
                  <p style={{ margin: '3px 0' }}><strong>입력:</strong> "{step.content}"</p>
                  {step.analysis.matchedSymptoms.length > 0 && (
                    <p style={{ margin: '3px 0' }}><strong>감지된 증상:</strong> {step.analysis.matchedSymptoms.join(', ')}</p>
                  )}
                  {step.analysis.redFlags.length > 0 && (
                    <p style={{ margin: '3px 0', color: '#DC2626' }}><strong>⚠️ Red Flag:</strong> {step.analysis.redFlags.join(', ')}</p>
                  )}
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 10px',
                    borderRadius: '5px',
                    backgroundColor: '#F3F4F6',
                    fontSize: '12px',
                  }}>
                    <strong>KTAS 변화:</strong> {step.impact.beforeKTAS} → <span style={{ color: getLevelColor(parseInt(step.impact.afterKTAS) || 5), fontWeight: 'bold' }}>KTAS {step.impact.afterKTAS}</span>
                    <br />
                    <strong>이유:</strong> {step.impact.reason}
                  </div>
                </div>
              )}

              {/* Step 2: 추가 질문 */}
              {step.type === 'questions' && step.questions?.map((q, qIdx) => (
                <div key={qIdx} style={{
                  paddingLeft: '36px',
                  marginBottom: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#F9FAFB',
                  fontSize: '13px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#1F2937' }}>Q: {q.question}</strong>
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{q.necessity}</span>
                  </div>
                  <p style={{ margin: '2px 0', color: '#3B82F6' }}><strong>A:</strong> {q.answer}</p>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    KTAS: {q.beforeKTAS} → <span style={{ color: getLevelColor(parseInt(q.afterKTAS) || 5), fontWeight: 'bold' }}>{q.afterKTAS}</span>
                  </div>
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#6B7280' }}>→ {q.reason}</p>
                </div>
              ))}

              {/* Step 3: 최종 판정 */}
              {step.type === 'result' && (
                <div style={{ paddingLeft: '36px' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    backgroundColor: getLevelColor(step.finalKTAS),
                    color: 'white',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '10px',
                  }}>
                    KTAS Level {step.finalKTAS}: {step.ktasInfo?.name || ''}
                  </div>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#4B5563' }}>
                    <strong>응답 시간:</strong> {step.ktasInfo?.responseTime || '-'}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#4B5563' }}>
                    <strong>신뢰도:</strong> {(step.finalConfidence * 100).toFixed(0)}%
                  </p>
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#4B5563' }}>확정 사유:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '13px', color: '#4B5563' }}>
                      {step.finalReasons.map((r, i) => <li key={i} style={{ marginBottom: '3px' }}>{r}</li>)}
                    </ul>
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#4B5563' }}>권장 사항:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '13px', color: '#4B5563' }}>
                      {step.recommendations.map((r, i) => <li key={i} style={{ marginBottom: '3px' }}>{r}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 4: 응급 처치 가이드 */}
              {step.type === 'emergency_care' && step.care && (
                <div style={{ paddingLeft: '36px', fontSize: '13px' }}>
                  <p style={{ margin: '5px 0', fontWeight: 'bold', color: '#1F2937' }}>처치 시간: {currentAssessment.ktasInfo?.responseTime || '-'}</p>
                  <div style={{ marginTop: '8px' }}>
                    <strong style={{ color: '#DC2626' }}>필수 검사/처치:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#4B5563' }}>
                      {step.care.required.map((c, i) => <li key={i}>☐ {c}</li>)}
                    </ul>
                  </div>
                  {step.care.recommended.length > 0 && (
                    <div style={{ marginTop: '5px' }}>
                      <strong style={{ color: '#CA8A04' }}>권장 검사:</strong>
                      <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#4B5563' }}>
                        {step.care.recommended.map((c, i) => <li key={i}>☐ {c}</li>)}
                      </ul>
                    </div>
                  )}
                  {step.care.prohibited.length > 0 && (
                    <div style={{ marginTop: '5px' }}>
                      <strong style={{ color: '#DC2626' }}>금지 사항:</strong>
                      <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#DC2626' }}>
                        {step.care.prohibited.map((c, i) => <li key={i}>✗ {c}</li>)}
                      </ul>
                    </div>
                  )}
                  <p style={{ margin: '8px 0 0 0', fontWeight: 'bold', color: '#3B82F6' }}>
                    {step.care.nextStep}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* 하단 버튼 */}
          <div style={{ padding: '15px', border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 10px 10px', backgroundColor: '#F9FAFB', textAlign: 'center' }}>
            <button onClick={resetAssessment} style={{ padding: '10px 30px', borderRadius: '8px', border: 'none', backgroundColor: '#3B82F6', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              🔄 새 평가 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KTASAISystem;
