class DataCollector {
  constructor(db) {
    this.db = db;
  }

  createSession(sessionId, userId, userRole, ipAddress, userAgent) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO sessions (sessionId, userId, userRole, ipAddress, userAgent)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, userId, userRole, ipAddress, userAgent],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ 세션 시작: ${sessionId}`);
            resolve(sessionId);
          }
        }
      );
    });
  }

  endSession(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE sessions SET endTime = CURRENT_TIMESTAMP WHERE sessionId = ?`,
        [sessionId],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ 세션 종료: ${sessionId}`);
            resolve();
          }
        }
      );
    });
  }

  saveMessage(sessionId, userRole, message, speechProvider, speechConfidence, aiProvider, aiModel) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO messages 
         (sessionId, userRole, message, speechProvider, speechConfidence, aiProvider, aiModel)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, userRole, message, speechProvider, speechConfidence, aiProvider, aiModel],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ 메시지 저장: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  saveAssessment(sessionId, messageId, ktasLevel, confidence, symptoms, redFlags, recommendations) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO assessments 
         (sessionId, messageId, ktasLevel, confidence, symptoms, redFlags, recommendations)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          messageId,
          ktasLevel,
          confidence,
          JSON.stringify(symptoms),
          JSON.stringify(redFlags),
          JSON.stringify(recommendations)
        ],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ 평가 저장: KTAS Level ${ktasLevel}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  saveFeedback(assessmentId, userFeedback, actualKTASLevel, isCorrect) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO feedback (assessmentId, userFeedback, actualKTASLevel, isCorrect)
         VALUES (?, ?, ?, ?)`,
        [assessmentId, userFeedback, actualKTASLevel, isCorrect ? 1 : 0],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`피드백 저장`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  saveSpeechAnalysis(sessionId, transcript, recognizedRole, speechSpeed, confidenceScore, medicalTermCount, emotionalIndicators) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO speechAnalysis 
         (sessionId, transcript, recognizedRole, speechSpeed, confidenceScore, medicalTermCount, emotionalIndicators)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          transcript,
          recognizedRole,
          speechSpeed,
          confidenceScore,
          medicalTermCount,
          JSON.stringify(emotionalIndicators)
        ],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ 음성 분석: ${recognizedRole}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  saveAIAnalysis(messageId, aiProvider, responseTime, responseQuality, tokenUsage, cost) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO aiAnalysis 
         (messageId, aiProvider, responseTime, responseQuality, tokenUsage, cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [messageId, aiProvider, responseTime, responseQuality, JSON.stringify(tokenUsage), cost],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✅ AI 분석: ${aiProvider}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }
}

module.exports = DataCollector;