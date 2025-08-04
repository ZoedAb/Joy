import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import './ComprehensiveReport.css';

interface ComprehensiveReportProps {
  pitchId: number;
  onClose: () => void;
}

interface ReportData {
  report_id: string;
  pitch_id: number;
  generated_at: string;
  report_type: string;
  content: any;
  visualizations: { [key: string]: string };
  overall_scores: { [key: string]: number | string };
  recommendations: any;
  metadata: any;
}

const ComprehensiveReport: React.FC<ComprehensiveReportProps> = ({ pitchId, onClose }) => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportType, setSelectedReportType] = useState('detailed_analysis');
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'recommendations' | 'visualizations'>('overview');

  const generateReport = useCallback(async (reportType: string = selectedReportType) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post(
        `/pitches/${pitchId}/comprehensive-report?report_type=${reportType}`,
        {}
      );
      
      setReport(response.data);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }, [pitchId, selectedReportType]);

  const fetchAvailableTemplates = async () => {
    try {
      const response = await api.get('/reports/templates');
      setAvailableTemplates(response.data.templates);
    } catch (error) {
      console.error('Failed to fetch report templates:', error);
    }
  };

  useEffect(() => {
    fetchAvailableTemplates();
    generateReport();
  }, [pitchId, generateReport]);

  const handleReportTypeChange = (newType: string) => {
    setSelectedReportType(newType);
    generateReport(newType);
  };

  const downloadReport = () => {
    if (!report) return;

    const reportData = {
      ...report,
      generated_for_download: new Date().toISOString()
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `pitch_report_${pitchId}_${report.report_type}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const formatScore = (score: number | string): string => {
    if (typeof score === 'number') {
      return Math.round(score).toString();
    }
    return score.toString();
  };

  const getScoreColor = (score: number | string): string => {
    const numScore = typeof score === 'number' ? score : parseFloat(score.toString());
    if (numScore >= 80) return '#28a745';
    if (numScore >= 60) return '#ffc107';
    return '#dc3545';
  };

  const renderOverview = () => {
    if (!report?.content) return null;

    const content = report.content;
    const scores = report.overall_scores;

    return (
      <div className="report-overview">
        <div className="overview-header">
          <h2>Performance Overview</h2>
          <div className="overall-grade">
            <span className="grade-letter">{scores.letter_grade || 'C'}</span>
            <span className="grade-score">{formatScore(scores.overall_score || 50)}/100</span>
          </div>
        </div>

        <div className="key-metrics">
          <div className="metric-card">
            <h4>Voice Confidence</h4>
            <div 
              className="metric-value"
              style={{ color: getScoreColor(scores.voice_confidence || 50) }}
            >
              {formatScore(scores.voice_confidence || 50)}
            </div>
          </div>

          <div className="metric-card">
            <h4>Emotional Expression</h4>
            <div 
              className="metric-value"
              style={{ color: getScoreColor(scores.emotional_appropriateness || 50) }}
            >
              {formatScore(scores.emotional_appropriateness || 50)}
            </div>
          </div>

          <div className="metric-card">
            <h4>Visual Presentation</h4>
            <div 
              className="metric-value"
              style={{ color: getScoreColor(scores.visual_presentation || 50) }}
            >
              {formatScore(scores.visual_presentation || 50)}
            </div>
          </div>

          <div className="metric-card">
            <h4>Content Quality</h4>
            <div 
              className="metric-value"
              style={{ color: getScoreColor(scores.content_quality || 50) }}
            >
              {formatScore(scores.content_quality || 50)}
            </div>
          </div>
        </div>

        {content.key_insights && (
          <div className="insights-section">
            <h3>Key Insights</h3>
            <p>{content.key_insights}</p>
          </div>
        )}

        {content.top_strengths && (
          <div className="strengths-section">
            <h3>Top Strengths</h3>
            <ul>
              {content.top_strengths.map((strength: string, index: number) => (
                <li key={index} className="strength-item">{strength}</li>
              ))}
            </ul>
          </div>
        )}

        {content.priority_improvements && (
          <div className="improvements-section">
            <h3>Priority Improvements</h3>
            <ul>
              {content.priority_improvements.map((improvement: string, index: number) => (
                <li key={index} className="improvement-item">{improvement}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderAnalysis = () => {
    if (!report?.content?.analysis_breakdown) return null;

    const analysis = report.content.analysis_breakdown;

    return (
      <div className="report-analysis">
        <h2>Detailed Analysis Breakdown</h2>

        {analysis.voice_analysis && (
          <div className="analysis-section">
            <h3>Voice Analysis</h3>
            <div className="analysis-details">
              <p><strong>Confidence Score:</strong> {analysis.voice_analysis.confidence_score || 'N/A'}</p>
              <p><strong>Speaking Pace:</strong> {analysis.voice_analysis.speaking_pace || 'N/A'} WPM</p>
              <p><strong>Overall Grade:</strong> {analysis.voice_analysis.overall_grade || 'N/A'}</p>
            </div>
          </div>
        )}

        {analysis.enhanced_voice && (
          <div className="analysis-section">
            <h3>Enhanced Voice Emotion Analysis</h3>
            <div className="analysis-details">
              <p><strong>Business Score:</strong> {Math.round((analysis.enhanced_voice.business_score || 0) * 100)}/100</p>
              {analysis.enhanced_voice.emotion_scores && (
                <div className="emotion-scores">
                  <h4>Emotion Breakdown:</h4>
                  {Object.entries(analysis.enhanced_voice.emotion_scores).map(([emotion, score]) => (
                    <div key={emotion} className="emotion-item">
                      <span className="emotion-name">{emotion}:</span>
                      <span className="emotion-score">{Math.round((score as number) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {analysis.video_emotion && (
          <div className="analysis-section">
            <h3>Video Emotion Analysis</h3>
            <div className="analysis-details">
              <p><strong>Dominant Emotion:</strong> {analysis.video_emotion.dominant_emotion || 'N/A'}</p>
              <p><strong>Emotion Stability:</strong> {Math.round((analysis.video_emotion.stability || 0) * 100)}%</p>
              <p><strong>Business Appropriateness:</strong> {Math.round((analysis.video_emotion.business_appropriateness || 0) * 100)}/100</p>
            </div>
          </div>
        )}

        {analysis.content_analysis && (
          <div className="analysis-section">
            <h3>Content Analysis</h3>
            <div className="analysis-details">
              <p><strong>Word Count:</strong> {analysis.content_analysis.word_count || 'N/A'}</p>
              <p><strong>Readability Score:</strong> {Math.round(analysis.content_analysis.readability || 0)}</p>
              <p><strong>Similarity to Successful Pitches:</strong> {Math.round((analysis.content_analysis.similarity_score || 0) * 100)}%</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (!report?.recommendations) return null;

    const recommendations = report.recommendations;

    return (
      <div className="report-recommendations">
        <h2>Personalized Recommendations</h2>

        {recommendations.immediate_actions && (
          <div className="recommendations-section">
            <h3>🚀 Immediate Actions</h3>
            <ul>
              {recommendations.immediate_actions.map((action: string, index: number) => (
                <li key={index} className="recommendation-item immediate">{action}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.short_term_goals && (
          <div className="recommendations-section">
            <h3>🎯 30-Day Goals</h3>
            <ul>
              {recommendations.short_term_goals.map((goal: string, index: number) => (
                <li key={index} className="recommendation-item short-term">{goal}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.long_term_development && (
          <div className="recommendations-section">
            <h3>📈 Long-term Development</h3>
            <ul>
              {recommendations.long_term_development.map((item: string, index: number) => (
                <li key={index} className="recommendation-item long-term">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.practice_exercises && (
          <div className="recommendations-section">
            <h3>💪 Practice Exercises</h3>
            <ul>
              {recommendations.practice_exercises.map((exercise: string, index: number) => (
                <li key={index} className="recommendation-item exercise">{exercise}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendations.resources && (
          <div className="recommendations-section">
            <h3>📚 Recommended Resources</h3>
            <ul>
              {recommendations.resources.map((resource: string, index: number) => (
                <li key={index} className="recommendation-item resource">{resource}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderVisualizations = () => {
    if (!report?.visualizations) return null;

    const visualizations = report.visualizations;

    return (
      <div className="report-visualizations">
        <h2>Performance Visualizations</h2>
        
        <div className="visualizations-grid">
          {Object.entries(visualizations).map(([key, base64Data]) => (
            <div key={key} className="visualization-item">
              <h3>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
              {base64Data && (
                <img 
                  src={`data:image/png;base64,${base64Data}`} 
                  alt={key}
                  className="visualization-image"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="report-overlay">
        <div className="report-modal">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Generating comprehensive report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-overlay">
        <div className="report-modal">
          <div className="error-container">
            <h2>Report Generation Failed</h2>
            <p>{error}</p>
            <div className="error-actions">
              <button onClick={() => generateReport()} className="retry-button">
                Retry
              </button>
              <button onClick={onClose} className="close-button">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <div className="report-header">
          <div className="report-title">
            <h1>Comprehensive Pitch Report</h1>
            <span className="report-meta">
              Generated: {new Date(report?.generated_at || '').toLocaleDateString()} | 
              Type: {report?.report_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </div>
          <div className="report-actions">
            <select 
              value={selectedReportType} 
              onChange={(e) => handleReportTypeChange(e.target.value)}
              className="report-type-selector"
            >
              {availableTemplates.map(template => (
                <option key={template.type} value={template.type}>
                  {template.name}
                </option>
              ))}
            </select>
            <button onClick={downloadReport} className="download-button">
              Download Report
            </button>
            <button onClick={onClose} className="close-button">
              ✕
            </button>
          </div>
        </div>

        <div className="report-tabs">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            Detailed Analysis
          </button>
          <button 
            className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            Recommendations
          </button>
          <button 
            className={`tab-button ${activeTab === 'visualizations' ? 'active' : ''}`}
            onClick={() => setActiveTab('visualizations')}
          >
            Visualizations
          </button>
        </div>

        <div className="report-content">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'analysis' && renderAnalysis()}
          {activeTab === 'recommendations' && renderRecommendations()}
          {activeTab === 'visualizations' && renderVisualizations()}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveReport;
