/**
 * Metric Validation and Auto-Calculation System
 * 
 * Validates extracted metrics, calculates missing values from available data,
 * and assigns confidence scores to each metric.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'calculated' | 'low' | 'manual';

export interface MetricValue {
  value: number | string | null;
  confidence: ConfidenceLevel;
  source: 'text' | 'vision' | 'calculated' | 'fallback';
  rawValue?: string; // Original extracted value before parsing
  formula?: string; // If calculated, what formula was used
}

export interface ValidatedMetrics {
  [metricId: string]: MetricValue;
}

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  metrics: ValidatedMetrics;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PlatformMetrics {
  google_ads?: ValidatedMetrics;
  meta_ads?: ValidatedMetrics;
  sms?: ValidatedMetrics;
  email?: ValidatedMetrics;
}

// =============================================================================
// METRIC REQUIREMENTS BY PLATFORM
// =============================================================================

export const REQUIRED_METRICS: Record<string, string[]> = {
  google_ads: ['cost', 'impressions', 'clicks', 'conversions'],
  meta_ads: ['spend', 'reach', 'clicks', 'conversions'],
  sms: ['sent', 'delivered', 'delivery_rate'],
  email: ['sent', 'opened', 'open_rate', 'clicks'],
};

export const CALCULABLE_METRICS: Record<string, { formula: string; requires: string[] }> = {
  ctr: { formula: '(clicks/impressions)*100', requires: ['clicks', 'impressions'] },
  cpc: { formula: 'cost/clicks', requires: ['cost', 'clicks'] },
  cost_per_conv: { formula: 'cost/conversions', requires: ['cost', 'conversions'] },
  conv_rate: { formula: '(conversions/clicks)*100', requires: ['conversions', 'clicks'] },
  roas: { formula: 'revenue/cost', requires: ['revenue', 'cost'] },
  cpm: { formula: '(cost/impressions)*1000', requires: ['cost', 'impressions'] },
  delivery_rate: { formula: '(delivered/sent)*100', requires: ['delivered', 'sent'] },
  open_rate: { formula: '(opened/sent)*100', requires: ['opened', 'sent'] },
  click_rate: { formula: '(clicks/opened)*100', requires: ['clicks', 'opened'] },
  frequency: { formula: 'impressions/reach', requires: ['impressions', 'reach'] },
};

// =============================================================================
// PARSING UTILITIES
// =============================================================================

/**
 * Parse a currency string to number
 * Handles: $1,234.56, 1234.56, $1.2K, $1.5M
 */
export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  
  const cleaned = value.toString()
    .replace(/[$,]/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle K/M suffixes
  if (cleaned.match(/k$/i)) {
    const num = parseFloat(cleaned.replace(/k$/i, ''));
    return isNaN(num) ? null : num * 1000;
  }
  if (cleaned.match(/m$/i)) {
    const num = parseFloat(cleaned.replace(/m$/i, ''));
    return isNaN(num) ? null : num * 1000000;
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a percentage string to number
 * Handles: 2.5%, 2.5, "2.5%"
 */
export function parsePercentage(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  
  const cleaned = value.toString()
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .trim();
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse an integer string to number
 * Handles: 1,234, 1234, "1234", 1.2K, 1.5M
 */
export function parseInteger(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Math.round(value);
  
  const cleaned = value.toString()
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Handle K/M suffixes
  if (cleaned.match(/k$/i)) {
    const num = parseFloat(cleaned.replace(/k$/i, ''));
    return isNaN(num) ? null : Math.round(num * 1000);
  }
  if (cleaned.match(/m$/i)) {
    const num = parseFloat(cleaned.replace(/m$/i, ''));
    return isNaN(num) ? null : Math.round(num * 1000000);
  }
  
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a decimal string to number
 */
export function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  
  const cleaned = value.toString()
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// =============================================================================
// CROSS-VALIDATION
// =============================================================================

/**
 * Compare text-extracted value with AI vision-extracted value
 * Returns the best value with confidence level
 */
export function crossValidate(
  textValue: number | null,
  visionValue: number | null,
  tolerance: number = 0.05 // 5% tolerance
): MetricValue {
  // Both have values
  if (textValue !== null && visionValue !== null) {
    const diff = Math.abs(textValue - visionValue);
    const maxVal = Math.max(Math.abs(textValue), Math.abs(visionValue));
    const percentDiff = maxVal > 0 ? diff / maxVal : 0;
    
    if (percentDiff <= tolerance) {
      // Values match within tolerance - high confidence
      return {
        value: textValue, // Prefer text extraction
        confidence: 'high',
        source: 'text',
      };
    } else {
      // Values don't match - use text but flag as medium confidence
      return {
        value: textValue,
        confidence: 'medium',
        source: 'text',
      };
    }
  }
  
  // Only text value available
  if (textValue !== null) {
    return {
      value: textValue,
      confidence: 'medium',
      source: 'text',
    };
  }
  
  // Only vision value available
  if (visionValue !== null) {
    return {
      value: visionValue,
      confidence: 'medium',
      source: 'vision',
    };
  }
  
  // Neither available
  return {
    value: null,
    confidence: 'low',
    source: 'fallback',
  };
}

// =============================================================================
// AUTO-CALCULATION
// =============================================================================

/**
 * Calculate a metric from other available metrics
 */
export function calculateMetric(
  metricId: string,
  availableMetrics: ValidatedMetrics
): MetricValue | null {
  const calcDef = CALCULABLE_METRICS[metricId];
  if (!calcDef) return null;
  
  // Check if all required metrics are available
  const values: Record<string, number> = {};
  for (const req of calcDef.requires) {
    const metric = availableMetrics[req];
    if (!metric || metric.value === null || typeof metric.value !== 'number') {
      return null; // Missing required metric
    }
    values[req] = metric.value;
  }
  
  // Calculate based on formula
  let result: number | null = null;
  
  try {
    switch (metricId) {
      case 'ctr':
        result = values.impressions > 0 ? (values.clicks / values.impressions) * 100 : 0;
        break;
      case 'cpc':
        result = values.clicks > 0 ? values.cost / values.clicks : 0;
        break;
      case 'cost_per_conv':
        result = values.conversions > 0 ? values.cost / values.conversions : 0;
        break;
      case 'conv_rate':
        result = values.clicks > 0 ? (values.conversions / values.clicks) * 100 : 0;
        break;
      case 'roas':
        result = values.cost > 0 ? values.revenue / values.cost : 0;
        break;
      case 'cpm':
        result = values.impressions > 0 ? (values.cost / values.impressions) * 1000 : 0;
        break;
      case 'delivery_rate':
        result = values.sent > 0 ? (values.delivered / values.sent) * 100 : 0;
        break;
      case 'open_rate':
        result = values.sent > 0 ? (values.opened / values.sent) * 100 : 0;
        break;
      case 'click_rate':
        result = values.opened > 0 ? (values.clicks / values.opened) * 100 : 0;
        break;
      case 'frequency':
        result = values.reach > 0 ? values.impressions / values.reach : 0;
        break;
    }
  } catch {
    return null;
  }
  
  if (result !== null) {
    return {
      value: Math.round(result * 100) / 100, // 2 decimal places
      confidence: 'calculated',
      source: 'calculated',
      formula: calcDef.formula,
    };
  }
  
  return null;
}

/**
 * Fill in missing metrics by calculating them from available data
 */
export function autoCalculateMissingMetrics(
  metrics: ValidatedMetrics,
  requiredMetricIds: string[]
): ValidatedMetrics {
  const result = { ...metrics };
  
  for (const metricId of requiredMetricIds) {
    if (!result[metricId] || result[metricId].value === null) {
      const calculated = calculateMetric(metricId, result);
      if (calculated) {
        result[metricId] = calculated;
      }
    }
  }
  
  // Also try to calculate all calculable metrics
  for (const metricId of Object.keys(CALCULABLE_METRICS)) {
    if (!result[metricId] || result[metricId].value === null) {
      const calculated = calculateMetric(metricId, result);
      if (calculated) {
        result[metricId] = calculated;
      }
    }
  }
  
  return result;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a platform's metrics
 */
export function validatePlatformMetrics(
  platform: string,
  metrics: ValidatedMetrics
): ValidationResult {
  const requiredMetrics = REQUIRED_METRICS[platform] || [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // First, try to calculate any missing metrics
  const enrichedMetrics = autoCalculateMissingMetrics(metrics, requiredMetrics);
  
  // Check required metrics
  let metricScore = 0;
  let totalRequired = requiredMetrics.length;
  
  for (const metricId of requiredMetrics) {
    const metric = enrichedMetrics[metricId];
    
    if (!metric || metric.value === null) {
      errors.push(`Missing required metric: ${metricId}`);
    } else {
      metricScore++;
      
      if (metric.confidence === 'low') {
        warnings.push(`Low confidence for ${metricId}: consider manual verification`);
      } else if (metric.confidence === 'calculated') {
        suggestions.push(`${metricId} was calculated from other metrics`);
      }
    }
  }
  
  // Check for zero values that might indicate data issues
  for (const [metricId, metric] of Object.entries(enrichedMetrics)) {
    if (metric.value === 0 && ['impressions', 'cost', 'spend'].includes(metricId)) {
      warnings.push(`${metricId} is zero - verify this is correct`);
    }
  }
  
  const score = totalRequired > 0 ? Math.round((metricScore / totalRequired) * 100) : 100;
  
  return {
    passed: errors.length === 0,
    score,
    metrics: enrichedMetrics,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Validate all platform metrics
 */
export function validateAllMetrics(platformMetrics: PlatformMetrics): {
  overallPassed: boolean;
  overallScore: number;
  results: Record<string, ValidationResult>;
} {
  const results: Record<string, ValidationResult> = {};
  let totalScore = 0;
  let platformCount = 0;
  let allPassed = true;
  
  for (const [platform, metrics] of Object.entries(platformMetrics)) {
    if (metrics) {
      const result = validatePlatformMetrics(platform, metrics);
      results[platform] = result;
      totalScore += result.score;
      platformCount++;
      if (!result.passed) allPassed = false;
    }
  }
  
  return {
    overallPassed: allPassed,
    overallScore: platformCount > 0 ? Math.round(totalScore / platformCount) : 100,
    results,
  };
}

// =============================================================================
// DATE RANGE VALIDATION
// =============================================================================

/**
 * Parse a date range string from Looker Studio
 * Handles formats like: "Dec 10, 2025 - Dec 31, 2025"
 */
export function parseDateRange(dateStr: string): { start: Date | null; end: Date | null } {
  if (!dateStr) return { start: null, end: null };
  
  // Try to split by common separators
  const parts = dateStr.split(/\s*[-–—]\s*/);
  
  if (parts.length !== 2) {
    return { start: null, end: null };
  }
  
  const parseDate = (str: string): Date | null => {
    try {
      // Handle "Dec 10, 2025" format
      const date = new Date(str.trim());
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };
  
  return {
    start: parseDate(parts[0]),
    end: parseDate(parts[1]),
  };
}

/**
 * Check if detected date range matches expected date range
 */
export function validateDateRange(
  expected: { startDate: string; endDate: string },
  detected: string
): { matches: boolean; expectedStr: string; detectedStr: string; error?: string } {
  const parsedDetected = parseDateRange(detected);
  
  if (!parsedDetected.start || !parsedDetected.end) {
    return {
      matches: false,
      expectedStr: `${expected.startDate} - ${expected.endDate}`,
      detectedStr: detected,
      error: 'Could not parse detected date range',
    };
  }
  
  const expectedStart = new Date(expected.startDate);
  const expectedEnd = new Date(expected.endDate);
  
  // Allow 1 day tolerance
  const startDiff = Math.abs(parsedDetected.start.getTime() - expectedStart.getTime());
  const endDiff = Math.abs(parsedDetected.end.getTime() - expectedEnd.getTime());
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  const matches = startDiff <= oneDayMs && endDiff <= oneDayMs;
  
  return {
    matches,
    expectedStr: `${expected.startDate} - ${expected.endDate}`,
    detectedStr: detected,
    error: matches ? undefined : 'Date range does not match expected range',
  };
}

// =============================================================================
// CONFIDENCE DISPLAY HELPERS
// =============================================================================

/**
 * Get display prefix for confidence level
 */
export function getConfidencePrefix(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case 'high':
      return '';
    case 'medium':
      return '~';
    case 'calculated':
      return '≈';
    case 'low':
      return '?';
    case 'manual':
      return '*';
    default:
      return '';
  }
}

/**
 * Get display style for confidence level
 */
export function getConfidenceStyle(confidence: ConfidenceLevel): {
  borderColor?: string;
  tooltip: string;
} {
  switch (confidence) {
    case 'high':
      return { tooltip: 'Verified from multiple sources' };
    case 'medium':
      return { tooltip: 'Extracted from single source' };
    case 'calculated':
      return { tooltip: 'Calculated from other metrics' };
    case 'low':
      return { borderColor: 'amber', tooltip: 'Low confidence - verify manually' };
    case 'manual':
      return { borderColor: 'red', tooltip: 'Requires manual verification' };
    default:
      return { tooltip: '' };
  }
}
