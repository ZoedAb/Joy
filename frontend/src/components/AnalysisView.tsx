import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AnalysisView.css';

interface AnalysisResult {
  basic_stats: {
    word_count: number;
    sentence_count: number;
    avg_words_per_sentence: number;
    vocabulary_richness: number;
  };
  emotion_analysis: {
    emotion_scores: Record<string, number>;
    dominant_emotion: string;
    emotional_stability: string;
    pitch_appropriateness: string;
    error?: string;
  };
  confidence_analysis: {
    confidence_score: number;
    assessment: string;
    error?: string;
  };
  sentiment_analysis: {
    overall_sentiment: string;
    positivity_ratio: number;
    pitch_sentiment_assessment: string;
    error?: string;
  };
  pitch_similarity: {
    max_similarity: number;
    avg_similarity: number;
    similarity_assessment: string;
    error?: string;
  };
  readability_analysis: {
    flesch_reading_ease: number;
    flesch_kincaid_grade: number;
    readability_assessment: string;
    error?: string;
  };
  speaking_pace: {
    words_per_minute: number;
    assessment: string;
  };
  confidence_score: number;
  overall_grade: string;
  recommendations: string[];
  error?: string;
}

interface InvestorResponse {
  investor: {
    name: string;
    title: string;
    style: string;
    personality: string;
  };
  initial_reaction: string;
  questions: string[];
  feedback: string[];
  follow_up: string;
  overall_interest: string;
  key_concerns: string[];
  suggested_improvements: string[];
  timestamp: string;
}

interface AnalysisViewProps {
  pitchId: number;
  onClose: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ pitchId, onClose }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [investorResponse, setInvestorResponse] = useState<InvestorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInvestor, setLoadingInvestor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'investor'>('analysis');

  useEffect(() => {
    fetchAnalysis();
  }, [pitchId]);

  const fetchAnalysis = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/pitches/${pitchId}/analysis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalysis(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const generateInvestorResponse = async () => {
    setLoadingInvestor(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `http://localhost:8000/pitches/${pitchId}/investor-response`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInvestorResponse(response.data);
      setActiveTab('investor');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate investor response');
    } finally {
      setLoadingInvestor(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#4CAF50';
      case 'B': return '#8BC34A';
      case 'C': return '#FF9800';
      case 'D': return '#FF5722';
      default: return '#F44336';
    }
  };

  if (loading) {
    return (
      <div className="analysis-overlay">
        <div className="analysis-modal">
          <div className="loading">Loading analysis...</div>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="analysis-overlay">
        <div className="analysis-modal">
          <div className="analysis-header">
            <h2>Analysis Error</h2>
            <button onClick={onClose} className="close-btn">&times;</button>
          </div>
          <div className="error">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-overlay">
      <div className="analysis-modal">
        <div className="analysis-header">
          <h2>Pitch Analysis</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="analysis-tabs">
          <button
            className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            AI Analysis
          </button>
          <button
            className={`tab ${activeTab === 'investor' ? 'active' : ''}`}
            onClick={() => setActiveTab('investor')}
          >
            Investor Response
          </button>
        </div>

        {activeTab === 'analysis' && analysis && (
          <div className="analysis-content">
            {analysis.error ? (
              <div className="error">{analysis.error}</div>
            ) : (
              <>
                {/* Overall Score */}
                <div className="score-section">
                  <div className="overall-score">
                    <h3>Overall Performance</h3>
                    <div className="score-display">
                      <div 
                        className="score-circle"
                        style={{ borderColor: getScoreColor(analysis.confidence_score) }}
                      >
                        <span style={{ color: getScoreColor(analysis.confidence_score) }}>
                          {analysis.confidence_score}
                        </span>
                      </div>
                      <div 
                        className="grade-badge"
                        style={{ backgroundColor: getGradeColor(analysis.overall_grade) }}
                      >
                        {analysis.overall_grade}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="metrics-grid">
                  <div className="metric-card">
                    <h4>Confidence Level</h4>
                    <div className="metric-value">{analysis.confidence_analysis?.confidence_score || 'N/A'}</div>
                    <div className="metric-label">{analysis.confidence_analysis?.assessment || ''}</div>
                  </div>

                  <div className="metric-card">
                    <h4>Emotional Tone</h4>
                    <div className="metric-value">{analysis.emotion_analysis?.dominant_emotion || 'N/A'}</div>
                    <div className="metric-label">{analysis.emotion_analysis?.pitch_appropriateness || ''}</div>
                  </div>

                  <div className="metric-card">
                    <h4>Clarity</h4>
                    <div className="metric-value">{analysis.readability_analysis?.flesch_reading_ease?.toFixed(1) || 'N/A'}</div>
                    <div className="metric-label">{analysis.readability_analysis?.readability_assessment || ''}</div>
                  </div>

                  <div className="metric-card">
                    <h4>Speaking Pace</h4>
                    <div className="metric-value">{analysis.speaking_pace?.words_per_minute || 'N/A'} WPM</div>
                    <div className="metric-label">{analysis.speaking_pace?.assessment || ''}</div>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="detailed-analysis">
                  <h3>Detailed Insights</h3>

                  {analysis.sentiment_analysis && !analysis.sentiment_analysis.error && (
                    <div className="analysis-section">
                      <h4>Sentiment Analysis</h4>
                      <p><strong>Overall Sentiment:</strong> {analysis.sentiment_analysis.overall_sentiment}</p>
                      <p><strong>Assessment:</strong> {analysis.sentiment_analysis.pitch_sentiment_assessment}</p>
                    </div>
                  )}

                  {analysis.pitch_similarity && !analysis.pitch_similarity.error && (
                    <div className="analysis-section">
                      <h4>Pitch Structure</h4>
                      <p><strong>Similarity to Successful Pitches:</strong> {(analysis.pitch_similarity.max_similarity * 100).toFixed(1)}%</p>
                      <p><strong>Assessment:</strong> {analysis.pitch_similarity.similarity_assessment}</p>
                    </div>
                  )}

                  <div className="analysis-section">
                    <h4>Basic Statistics</h4>
                    <div className="stats-grid">
                      <div><strong>Words:</strong> {analysis.basic_stats.word_count}</div>
                      <div><strong>Sentences:</strong> {analysis.basic_stats.sentence_count}</div>
                      <div><strong>Avg Words/Sentence:</strong> {analysis.basic_stats.avg_words_per_sentence}</div>
                      <div><strong>Vocabulary Richness:</strong> {(analysis.basic_stats.vocabulary_richness * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="recommendations">
                    <h3>AI Recommendations</h3>
                    <ul>
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'investor' && (
          <div className="investor-content">
            {!investorResponse ? (
              <div className="generate-investor">
                <h3>Virtual Investor Feedback</h3>
                <p>Get realistic feedback from our AI investor panel based on your pitch analysis.</p>
                <button
                  onClick={generateInvestorResponse}
                  disabled={loadingInvestor}
                  className="generate-btn"
                >
                  {loadingInvestor ? 'Generating...' : 'Generate Investor Response'}
                </button>
              </div>
            ) : (
              <div className="investor-response">
                <div className="investor-info">
                  <h3>{investorResponse.investor.name}</h3>
                  <p className="investor-title">{investorResponse.investor.title}</p>
                  <p className="investor-style">Style: {investorResponse.investor.style} • {investorResponse.investor.personality}</p>
                </div>

                <div className="interest-level">
                  <h4>Interest Level: <span className={`interest ${investorResponse.overall_interest.toLowerCase().replace(' ', '-')}`}>
                    {investorResponse.overall_interest}
                  </span></h4>
                </div>

                <div className="response-section">
                  <h4>Initial Reaction</h4>
                  <p className="reaction">{investorResponse.initial_reaction}</p>
                </div>

                <div className="response-section">
                  <h4>Questions</h4>
                  <ul className="questions-list">
                    {investorResponse.questions.map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                </div>

                {investorResponse.feedback && investorResponse.feedback.length > 0 && (
                  <div className="response-section">
                    <h4>Feedback</h4>
                    <ul className="feedback-list">
                      {investorResponse.feedback.map((feedback, index) => (
                        <li key={index}>{feedback}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {investorResponse.key_concerns && investorResponse.key_concerns.length > 0 && (
                  <div className="response-section concerns">
                    <h4>Key Concerns</h4>
                    <ul>
                      {investorResponse.key_concerns.map((concern, index) => (
                        <li key={index}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {investorResponse.suggested_improvements && investorResponse.suggested_improvements.length > 0 && (
                  <div className="response-section improvements">
                    <h4>Suggested Improvements</h4>
                    <ul>
                      {investorResponse.suggested_improvements.map((improvement, index) => (
                        <li key={index}>{improvement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="response-section">
                  <h4>Next Steps</h4>
                  <p className="follow-up">{investorResponse.follow_up}</p>
                </div>

                <button
                  onClick={generateInvestorResponse}
                  disabled={loadingInvestor}
                  className="regenerate-btn"
                >
                  {loadingInvestor ? 'Generating...' : 'Generate New Response'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisView;
