import { useState, useCallback } from 'react';

interface DataPoint {
  [key: string]: number | string;
}

interface AnalysisResult {
  correlations: Record<string, Record<string, number>>;
  outliers: Record<string, number[]>;
  missingValues: Record<string, number>;
  distributions: Record<string, {
    type: 'normal' | 'skewed' | 'uniform' | 'unknown';
    skewness?: number;
    kurtosis?: number;
  }>;
}

export function useDataAnalysis(initialData: DataPoint[] = []) {
  const [data, setData] = useState<DataPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const calculateCorrelations = useCallback((numericColumns: string[]) => {
    const correlations: Record<string, Record<string, number>> = {};

    numericColumns.forEach(col1 => {
      correlations[col1] = {};
      numericColumns.forEach(col2 => {
        if (col1 === col2) {
          correlations[col1][col2] = 1;
          return;
        }

        const values1 = data.map(d => Number(d[col1]));
        const values2 = data.map(d => Number(d[col2]));

        const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
        const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

        const variance1 = values1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0);
        const variance2 = values2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0);

        const covariance = values1.reduce((a, b, i) => {
          return a + (b - mean1) * (values2[i] - mean2);
        }, 0);

        correlations[col1][col2] = covariance / Math.sqrt(variance1 * variance2);
      });
    });

    return correlations;
  }, [data]);

  const detectOutliers = useCallback((numericColumns: string[]) => {
    const outliers: Record<string, number[]> = {};

    numericColumns.forEach(column => {
      const values = data.map(d => Number(d[column]));
      const sorted = [...values].sort((a, b) => a - b);
      
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      outliers[column] = values.filter(v => v < lowerBound || v > upperBound);
    });

    return outliers;
  }, [data]);

  const analyzeMissingValues = useCallback(() => {
    const missingValues: Record<string, number> = {};

    if (data.length === 0) return missingValues;

    Object.keys(data[0]).forEach(column => {
      missingValues[column] = data.filter(d => 
        d[column] === null || 
        d[column] === undefined || 
        d[column] === ''
      ).length;
    });

    return missingValues;
  }, [data]);

  const analyzeDistributions = useCallback((numericColumns: string[]) => {
    const distributions: Record<string, {
      type: 'normal' | 'skewed' | 'uniform' | 'unknown';
      skewness?: number;
      kurtosis?: number;
    }> = {};

    numericColumns.forEach(column => {
      const values = data.map(d => Number(d[column]));
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      
      // Calculate standard deviation
      const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
      const std = Math.sqrt(variance);

      // Calculate skewness
      const skewness = values.reduce((a, b) => {
        return a + Math.pow(b - mean, 3);
      }, 0) / (n * Math.pow(std, 3));

      // Calculate kurtosis
      const kurtosis = values.reduce((a, b) => {
        return a + Math.pow(b - mean, 4);
      }, 0) / (n * Math.pow(std, 4)) - 3;

      // Determine distribution type
      let type: 'normal' | 'skewed' | 'uniform' | 'unknown' = 'unknown';
      
      if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 0.5) {
        type = 'normal';
      } else if (Math.abs(skewness) > 1) {
        type = 'skewed';
      } else {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        const binWidth = range / Math.sqrt(n);
        const bins = new Array(Math.ceil(range / binWidth)).fill(0);
        
        values.forEach(v => {
          const binIndex = Math.floor((v - min) / binWidth);
          bins[binIndex]++;
        });
        
        const expectedCount = n / bins.length;
        const chiSquare = bins.reduce((a, b) => {
          return a + Math.pow(b - expectedCount, 2) / expectedCount;
        }, 0);
        
        if (chiSquare < bins.length * 3) {
          type = 'uniform';
        }
      }

      distributions[column] = {
        type,
        skewness,
        kurtosis,
      };
    });

    return distributions;
  }, [data]);

  const analyzeData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (data.length === 0) {
        throw new Error('No data available for analysis');
      }

      const numericColumns = Object.keys(data[0]).filter(column => {
        return data.every(d => !isNaN(Number(d[column])));
      });

      const result: AnalysisResult = {
        correlations: calculateCorrelations(numericColumns),
        outliers: detectOutliers(numericColumns),
        missingValues: analyzeMissingValues(),
        distributions: analyzeDistributions(numericColumns),
      };

      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [data, calculateCorrelations, detectOutliers, analyzeMissingValues, analyzeDistributions]);

  const updateData = useCallback((newData: DataPoint[]) => {
    setData(newData);
    setAnalysisResult(null);
  }, []);

  return {
    data,
    loading,
    error,
    analysisResult,
    analyzeData,
    updateData,
  };
} 