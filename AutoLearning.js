const fs = require('fs');
const path = require('path');

class AutoLearning {
  constructor(db) {
    this.db = db;
    this.learningConfig = {
      minTrainingDataForFinetuning: 100,
      trainingDataQualityThreshold: 0.7,
      updateFrequency: 'daily',
      lastUpdate: new Date(),
      isLearning: false,
      accuracy: 0.85
    };
    
    this.trainingStats = {
      totalDataPoints: 0,
      approvedDataPoints: 0,
      rejectedDataPoints: 0,
      averageQuality: 0,
      lastTrainingDate: null
    };

    this.startAutoLearning();
  }

  async addTrainingData(data) {
    const {
      input,
      output,
      ktasLevel,
      feedback,
      priority = 'normal'
    } = data;

    const quality = this.calculateDataQuality(input, output, ktasLevel, feedback);

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO trainingData (input, output, ktasLevel, quality)
         VALUES (?, ?, ?, ?)`,
        [input || feedback, output, ktasLevel, quality],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`📚 학습 데이터 추가됨`);
            resolve({
              id: this.lastID,
              quality,
              priority
            });
          }
        }
      );
    });
  }

  calculateDataQuality(input, output, ktasLevel, feedback = '') {
    let score = 0.5;

    if (input && input.length > 50) {
      score += 0.15;
    } else if (input && input.length > 20) {
      score += 0.05;
    }

    if (output && output.length > 100) {
      score += 0.15;
    } else if (output && output.length > 50) {
      score += 0.05;
    }

    if (ktasLevel >= 1 && ktasLevel <= 5) {
      score += 0.1;
    }

    if (feedback && feedback.length > 50) {
      score += 0.1;
    } else if (feedback && feedback.length > 20) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  startAutoLearning() {
    console.log('🤖 자동 학습 엔진 시작');

    setInterval(() => {
      this.analyzeAndLearn();
    }, 24 * 60 * 60 * 1000);

    this.analyzeAndLearn();
  }

  async analyzeAndLearn() {
    console.log('\n📊 학습 데이터 분석 중...');
    this.learningConfig.isLearning = true;

    try {
      const approvedData = await this.getApprovedTrainingData();
      console.log(`✅ 승인된 학습 데이터: ${approvedData.length}개`);

      const performance = await this.evaluateModelPerformance();
      console.log(`📈 현재 정확도: ${(performance.accuracy * 100).toFixed(2)}%`);

      const gaps = await this.identifyDataGaps();
      if (gaps.length > 0) {
        console.log(`⚠️ 데이터 부족 영역: ${gaps.join(', ')}`);
      }

      if (approvedData.length >= this.learningConfig.minTrainingDataForFinetuning) {
        await this.prepareFinetuningData(approvedData);
      }

      await this.updateLearningStats();

      this.learningConfig.lastUpdate = new Date();
      this.learningConfig.isLearning = false;

    } catch (error) {
      console.error('❌ 학습 중 오류:', error);
      this.learningConfig.isLearning = false;
    }
  }

  getApprovedTrainingData() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM trainingData 
         WHERE userApproved = 1 
         ORDER BY timestamp DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  evaluateModelPerformance() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(*) as totalFeedback,
          SUM(CASE WHEN isCorrect = 1 THEN 1 ELSE 0 END) as correctCount
         FROM feedback`,
        (err, row) => {
          if (err) reject(err);
          else {
            const accuracy = row && row.totalFeedback > 0 
              ? row.correctCount / row.totalFeedback 
              : 0;
            
            this.learningConfig.accuracy = accuracy;
            
            resolve({
              accuracy,
              totalAssessments: row?.totalFeedback || 0,
              correctAssessments: row?.correctCount || 0
            });
          }
        }
      );
    });
  }

  identifyDataGaps() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT ktasLevel, COUNT(*) as count
         FROM assessments
         GROUP BY ktasLevel
         ORDER BY count ASC`,
        (err, rows) => {
          if (err) reject(err);
          else {
            const gaps = [];
            rows?.forEach(row => {
              if (row.count < 10) {
                gaps.push(`KTAS Level ${row.ktasLevel}`);
              }
            });
            resolve(gaps);
          }
        }
      );
    });
  }

  async prepareFinetuningData(trainingData) {
    console.log('\n🔧 미세조정 데이터 준비 중...');

    const finetuneData = trainingData
      .filter(d => d.quality >= this.learningConfig.trainingDataQualityThreshold)
      .map(d => ({
        prompt: d.input,
        completion: d.output
      }));

    const filePath = path.join(__dirname, 'finetune_data.jsonl');
    const fileContent = finetuneData
      .map(item => JSON.stringify(item))
      .join('\n');

    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ 미세조정 데이터 저장: ${finetuneData.length}개`);
  }

  async updateLearningStats() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN userApproved = 1 THEN 1 ELSE 0 END) as approved,
          ROUND(AVG(quality), 3) as avgQuality
         FROM trainingData`,
        (err, row) => {
          if (err) reject(err);
          else {
            this.trainingStats.totalDataPoints = row?.total || 0;
            this.trainingStats.approvedDataPoints = row?.approved || 0;
            this.trainingStats.averageQuality = row?.avgQuality || 0;
            this.trainingStats.lastTrainingDate = new Date();
            resolve(this.trainingStats);
          }
        }
      );
    });
  }

  getStatus() {
    return {
      isLearning: this.learningConfig.isLearning,
      lastUpdate: this.learningConfig.lastUpdate,
      accuracy: this.learningConfig.accuracy,
      trainingStats: this.trainingStats,
      readyForFinetuning: this.trainingStats.approvedDataPoints >= 
                          this.learningConfig.minTrainingDataForFinetuning
    };
  }
}

module.exports = AutoLearning;