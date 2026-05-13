// Comprehensive QA validation system for deck generation
// Ensures data accuracy and quality at every step

export interface QACheckResult {
  passed: boolean;
  checkName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
  retryable?: boolean;
}

export interface QAReport {
  overallPassed: boolean;
  score: number; // 0-100
  criticalFailures: number;
  warnings: number;
  checks: QACheckResult[];
  timestamp: string;
  stage: string;
  retriesAttempted?: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 5000,  // 5 seconds
  maxDelayMs: 60000,  // 60 seconds
  backoffFactor: 2,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic for QA gates
 */
export async function withQARetry<T>(
  gateName: string,
  fn: (attempt: number, waitMultiplier: number) => Promise<T>,
  validateFn: (result: T) => QACheckResult[],
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ result: T; checks: QACheckResult[]; attempts: number }> {
  let lastResult: T | null = null;
  let lastChecks: QACheckResult[] = [];
  
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    const waitMultiplier = attempt; // Increase wait times with each attempt
    
    console.log(`[${gateName}] Attempt ${attempt}/${config.maxRetries + 1} (wait multiplier: ${waitMultiplier}x)`);
    
    try {
      lastResult = await fn(attempt, waitMultiplier);
      lastChecks = validateFn(lastResult);
      
      // Check if we have critical failures that are retryable
      const criticalRetryableFailures = lastChecks.filter(
        c => !c.passed && c.severity === 'critical' && c.retryable !== false
      );
      
      if (criticalRetryableFailures.length === 0) {
        // Success! No critical failures
        console.log(`[${gateName}] Passed on attempt ${attempt}`);
        return { result: lastResult, checks: lastChecks, attempts: attempt };
      }
      
      if (attempt <= config.maxRetries) {
        const delay = calculateRetryDelay(attempt, config);
        console.log(`[${gateName}] ${criticalRetryableFailures.length} critical issues, retrying in ${Math.round(delay / 1000)}s...`);
        criticalRetryableFailures.forEach(c => console.log(`  - ${c.checkName}: ${c.message}`));
        await sleep(delay);
      }
    } catch (error) {
      console.error(`[${gateName}] Attempt ${attempt} threw error:`, error);
      
      lastChecks = [{
        passed: false,
        checkName: `${gateName}_EXECUTION`,
        severity: 'critical',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      }];
      
      if (attempt <= config.maxRetries) {
        const delay = calculateRetryDelay(attempt, config);
        console.log(`[${gateName}] Error occurred, retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
      }
    }
  }
  
  // All retries exhausted
  console.log(`[${gateName}] All ${config.maxRetries + 1} attempts failed`);
  
  // Mark checks as final (no more retries)
  lastChecks = lastChecks.map(c => ({
    ...c,
    message: c.passed ? c.message : `${c.message} (after ${config.maxRetries + 1} attempts)`,
  }));
  
  return { result: lastResult as T, checks: lastChecks, attempts: config.maxRetries + 1 };
}

/**
 * Looker-specific retry configuration with longer waits
 */
export const LOOKER_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 10000,  // 10 seconds
  maxDelayMs: 90000,   // 90 seconds
  backoffFactor: 1.5,
};

/**
 * Branding extraction retry config
 */
export const BRANDING_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 3000,
  maxDelayMs: 15000,
  backoffFactor: 2,
};

/**
 * Data fetching retry config (GHL, Notion, etc.)
 */
export const DATA_FETCH_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  backoffFactor: 2,
};

/**
 * QA Check: Validate date range parameters
 */
export function validateDateRange(startDate: string, endDate: string): QACheckResult {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      passed: false,
      checkName: 'DATE_FORMAT_VALID',
      severity: 'critical',
      message: 'Invalid date format provided',
      details: { startDate, endDate },
      suggestion: 'Ensure dates are in YYYY-MM-DD format',
    };
  }

  if (start > end) {
    return {
      passed: false,
      checkName: 'DATE_RANGE_VALID',
      severity: 'critical',
      message: 'Start date is after end date',
      details: { startDate, endDate },
      suggestion: 'Swap start and end dates',
    };
  }

  if (end > now) {
    return {
      passed: false,
      checkName: 'DATE_NOT_FUTURE',
      severity: 'warning',
      message: 'End date is in the future - data may be incomplete',
      details: { endDate, today: now.toISOString().split('T')[0] },
      suggestion: 'Use dates up to today for complete data',
    };
  }

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 90) {
    return {
      passed: true,
      checkName: 'DATE_RANGE_LENGTH',
      severity: 'warning',
      message: `Date range spans ${daysDiff} days - consider shorter period for more actionable insights`,
      details: { daysDiff },
    };
  }

  return {
    passed: true,
    checkName: 'DATE_RANGE_VALID',
    severity: 'info',
    message: `Valid date range: ${daysDiff} days`,
    details: { startDate, endDate, daysDiff },
  };
}

/**
 * QA Check: Validate client data completeness
 */
export function validateClientData(clientName: string, lookerUrl?: string, domain?: string): QACheckResult[] {
  const checks: QACheckResult[] = [];

  // Client name validation
  if (!clientName || clientName.trim().length < 2) {
    checks.push({
      passed: false,
      checkName: 'CLIENT_NAME_VALID',
      severity: 'critical',
      message: 'Client name is missing or too short',
      suggestion: 'Provide a valid client name',
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'CLIENT_NAME_VALID',
      severity: 'info',
      message: `Client name: ${clientName}`,
    });
  }

  // Looker URL validation
  if (!lookerUrl) {
    checks.push({
      passed: false,
      checkName: 'LOOKER_URL_PROVIDED',
      severity: 'critical',
      message: 'No Looker Studio URL found for this client',
      suggestion: 'Add client to Looker Directory or provide URL manually',
    });
  } else if (!lookerUrl.includes('lookerstudio.google.com') && !lookerUrl.includes('datastudio.google.com')) {
    checks.push({
      passed: false,
      checkName: 'LOOKER_URL_VALID',
      severity: 'warning',
      message: 'URL may not be a valid Looker Studio report',
      details: { url: lookerUrl },
      suggestion: 'Verify the URL is a Looker Studio report link',
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'LOOKER_URL_VALID',
      severity: 'info',
      message: 'Valid Looker Studio URL found',
    });
  }

  // Domain validation
  if (!domain) {
    checks.push({
      passed: true,
      checkName: 'DOMAIN_PROVIDED',
      severity: 'warning',
      message: 'No domain provided - will use default branding',
      suggestion: 'Provide client domain for accurate branding extraction',
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'DOMAIN_PROVIDED',
      severity: 'info',
      message: `Domain: ${domain}`,
    });
  }

  return checks;
}

/**
 * QA Check: Validate Looker screenshot results
 * All critical failures here are retryable - Looker often needs multiple attempts
 */
export function validateLookerData(
  lookerData: {
    screenshots?: Array<{ image: string; section: string; category?: string }>;
    extractedMetrics?: Record<string, unknown>;
    aiAnalysis?: Record<string, unknown>;
  } | null,
  requestedStartDate: string,
  requestedEndDate: string
): QACheckResult[] {
  const checks: QACheckResult[] = [];

  if (!lookerData) {
    checks.push({
      passed: false,
      checkName: 'LOOKER_DATA_FETCHED',
      severity: 'critical',
      message: 'Failed to fetch Looker data - deck will be missing visual evidence',
      suggestion: 'Check Looker URL access and Firecrawl API key',
      retryable: true, // Can retry with longer wait times
    });
    return checks;
  }

  // Screenshot count validation
  const screenshotCount = lookerData.screenshots?.length || 0;
  if (screenshotCount === 0) {
    checks.push({
      passed: false,
      checkName: 'SCREENSHOTS_CAPTURED',
      severity: 'critical',
      message: 'No screenshots were captured from Looker',
      suggestion: 'Verify Looker URL loads correctly in browser',
      retryable: true, // Dashboard may need more time to load
    });
  } else if (screenshotCount < 10) {
    checks.push({
      passed: false,
      checkName: 'SCREENSHOT_COUNT',
      severity: 'critical',
      message: `Only ${screenshotCount} screenshots captured (minimum 10 required)`,
      details: { count: screenshotCount },
      suggestion: 'Dashboard may not have been fully scrolled - will retry with longer wait',
      retryable: true, // Can retry with more scroll time
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'SCREENSHOT_COUNT',
      severity: 'info',
      message: `${screenshotCount} screenshots captured`,
      details: { count: screenshotCount },
    });
  }

  // Screenshot quality validation
  if (lookerData.screenshots && lookerData.screenshots.length > 0) {
    const validScreenshots = lookerData.screenshots.filter(s => 
      s.image && s.image.startsWith('http') && s.image.length > 50
    );
    if (validScreenshots.length < lookerData.screenshots.length) {
      checks.push({
        passed: false,
        checkName: 'SCREENSHOT_QUALITY',
        severity: 'warning',
        message: `${lookerData.screenshots.length - validScreenshots.length} screenshots appear invalid`,
        details: { valid: validScreenshots.length, total: lookerData.screenshots.length },
        retryable: true,
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'SCREENSHOT_QUALITY',
        severity: 'info',
        message: `All ${validScreenshots.length} screenshots are valid`,
        details: { valid: validScreenshots.length },
      });
    }
  }

  // AI analysis validation
  if (!lookerData.aiAnalysis) {
    checks.push({
      passed: false,
      checkName: 'AI_ANALYSIS_PRESENT',
      severity: 'critical',
      message: 'AI analysis of screenshots not available',
      suggestion: 'AI insights will be limited without screenshot analysis - retrying',
      retryable: true,
    });
  } else {
    const sections = (lookerData.aiAnalysis as any).sections || [];
    checks.push({
      passed: true,
      checkName: 'AI_ANALYSIS_PRESENT',
      severity: 'info',
      message: `AI analyzed ${sections.length} dashboard sections`,
      details: { sectionCount: sections.length },
    });

    // Date confirmation check
    // NOTE: Some dashboards do not visibly display the active date range.
    // We still apply the requested date params to the URL; lack of visual confirmation
    // should not block generation (but should be surfaced as a QA warning).
    const dateConfirmed = sections.some((s: any) => s.dateRangeConfirmed === true);
    if (!dateConfirmed) {
      checks.push({
        passed: false,
        checkName: 'DATE_RANGE_CONFIRMED',
        severity: 'warning',
        message: `Could not visually confirm date range ${requestedStartDate} to ${requestedEndDate} in screenshots`,
        details: { requestedStart: requestedStartDate, requestedEnd: requestedEndDate },
        suggestion: 'Ensure the dashboard displays the active date range (or add it to the header) for stronger QA',
        retryable: false,
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'DATE_RANGE_CONFIRMED',
        severity: 'info',
        message: 'Date range confirmed in dashboard screenshots',
      });
    }
  }

  // Extracted metrics validation
  const metrics = (lookerData.extractedMetrics as any)?.metrics || {};
  const metricCount = Object.keys(metrics).length;
  if (metricCount === 0) {
    checks.push({
      passed: false,
      checkName: 'METRICS_EXTRACTED',
      severity: 'warning',
      message: 'No metrics were extracted from Looker dashboard',
      suggestion: 'Deck will rely on fallback data sources',
      retryable: true,
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'METRICS_EXTRACTED',
      severity: 'info',
      message: `${metricCount} metrics extracted from dashboard`,
      details: { metricCount, sampleMetrics: Object.keys(metrics).slice(0, 5) },
    });
  }

  return checks;
}

/**
 * QA Check: Validate GHL data completeness
 */
export function validateGHLData(ghlData: {
  contacts?: { total: number; newThisPeriod: number };
  opportunities?: { total: number; totalValue: number };
  workflows?: { active: number; executed: number };
  emails?: { sent: number; opened: number };
  sms?: { sent: number; delivered: number };
} | null): QACheckResult[] {
  const checks: QACheckResult[] = [];

  if (!ghlData) {
    checks.push({
      passed: true, // Not critical - we have fallbacks
      checkName: 'GHL_DATA_FETCHED',
      severity: 'warning',
      message: 'GHL data not available - using fallback sources',
      suggestion: 'Check GHL API key configuration and client location ID',
    });
    return checks;
  }

  checks.push({
    passed: true,
    checkName: 'GHL_DATA_FETCHED',
    severity: 'info',
    message: 'GHL data successfully retrieved',
  });

  // Validate contacts
  if (ghlData.contacts) {
    if (ghlData.contacts.total === 0 && ghlData.contacts.newThisPeriod === 0) {
      checks.push({
        passed: true,
        checkName: 'GHL_CONTACTS',
        severity: 'warning',
        message: 'No contacts found in GHL for this period',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'GHL_CONTACTS',
        severity: 'info',
        message: `${ghlData.contacts.newThisPeriod} new contacts (${ghlData.contacts.total} total)`,
      });
    }
  }

  // Validate workflows
  if (ghlData.workflows) {
    if (ghlData.workflows.active === 0) {
      checks.push({
        passed: true,
        checkName: 'GHL_WORKFLOWS',
        severity: 'warning',
        message: 'No active workflows found in GHL',
        suggestion: 'Verify client has workflows configured',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'GHL_WORKFLOWS',
        severity: 'info',
        message: `${ghlData.workflows.active} active workflows (${ghlData.workflows.executed} executions)`,
      });
    }
  }

  return checks;
}

/**
 * QA Check: Validate Notion tasks
 */
export function validateNotionTasks(tasks: unknown[]): QACheckResult {
  if (!tasks || !Array.isArray(tasks)) {
    return {
      passed: true,
      checkName: 'NOTION_TASKS_FETCHED',
      severity: 'warning',
      message: 'Notion tasks not available',
      suggestion: 'Check Notion API configuration',
    };
  }

  if (tasks.length === 0) {
    return {
      passed: true,
      checkName: 'NOTION_TASKS_FETCHED',
      severity: 'warning',
      message: 'No completed tasks found in Notion for this period',
      suggestion: 'Verify client name matches Notion project naming',
    };
  }

  return {
    passed: true,
    checkName: 'NOTION_TASKS_FETCHED',
    severity: 'info',
    message: `${tasks.length} completed tasks found in Notion`,
    details: { taskCount: tasks.length },
  };
}

/**
 * QA Check: Validate branding extraction
 */
export function validateBranding(brandColors: {
  primary: string;
  secondary: string;
  logo?: string;
} | null, domain?: string): QACheckResult[] {
  const checks: QACheckResult[] = [];
  const isDefault = !brandColors || brandColors.primary === "#6366f1";

  if (isDefault) {
    checks.push({
      passed: domain ? false : true, // Only fail if domain was provided
      checkName: 'BRANDING_EXTRACTED',
      severity: domain ? 'warning' : 'info',
      message: domain 
        ? `Could not extract branding from ${domain} - using defaults`
        : 'Using default branding (no domain provided)',
      suggestion: domain ? 'Verify domain is accessible and has visible branding' : undefined,
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'BRANDING_EXTRACTED',
      severity: 'info',
      message: `Brand colors extracted: ${brandColors.primary}`,
      details: { primary: brandColors.primary, hasLogo: !!brandColors.logo },
    });
  }

  if (brandColors?.logo) {
    // Validate logo URL
    if (!brandColors.logo.startsWith('http')) {
      checks.push({
        passed: false,
        checkName: 'LOGO_URL_VALID',
        severity: 'warning',
        message: 'Logo URL appears invalid',
        details: { logoUrl: brandColors.logo.substring(0, 50) },
      });
    }
  }

  return checks;
}

/**
 * QA Check: Validate deck content completeness
 */
export function validateDeckContent(deckContent: Record<string, unknown>): QACheckResult[] {
  const checks: QACheckResult[] = [];

  // Required sections
  const requiredSections = ['hero', 'googleAds', 'metaAds', 'sms', 'email', 'workflows', 'nextSteps'];
  const missingSections = requiredSections.filter(s => !deckContent[s]);

  if (missingSections.length > 0) {
    checks.push({
      passed: false,
      checkName: 'DECK_SECTIONS_COMPLETE',
      severity: 'critical',
      message: `Missing deck sections: ${missingSections.join(', ')}`,
      details: { missing: missingSections },
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'DECK_SECTIONS_COMPLETE',
      severity: 'info',
      message: 'All required deck sections present',
    });
  }

  // Validate metrics aren't all zeros
  const hero = deckContent.hero as Record<string, unknown> | undefined;
  const totalSpend = (hero?.totalSpend as number) || 0;
  const totalLeads = (hero?.totalLeads as number) || 0;

  if (totalSpend === 0 && totalLeads === 0) {
    checks.push({
      passed: false,
      checkName: 'METRICS_NOT_EMPTY',
      severity: 'critical',
      message: 'All key metrics are zero - deck will appear empty',
      suggestion: 'Verify data source connections and date range',
    });
  } else if (totalSpend === 0) {
    checks.push({
      passed: true,
      checkName: 'SPEND_DATA_PRESENT',
      severity: 'warning',
      message: 'Ad spend data is zero',
      suggestion: 'Verify ad spend metrics in Looker dashboard',
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'METRICS_NOT_EMPTY',
      severity: 'info',
      message: `Key metrics present: $${totalSpend.toLocaleString()} spend, ${totalLeads} leads`,
    });
  }

  // Screenshot count in final content
  const screenshots = deckContent.allScreenshots as unknown[] | undefined;
  if (!screenshots || screenshots.length === 0) {
    checks.push({
      passed: false,
      checkName: 'SCREENSHOTS_IN_CONTENT',
      severity: 'critical',
      message: 'No screenshots included in deck content',
      suggestion: 'Deck will be missing visual evidence slides',
    });
  }

  // Next steps validation
  const nextSteps = deckContent.nextSteps as Record<string, unknown> | undefined;
  const recommendations = (nextSteps?.recommendations as unknown[]) || [];
  if (recommendations.length === 0) {
    checks.push({
      passed: true,
      checkName: 'RECOMMENDATIONS_PRESENT',
      severity: 'warning',
      message: 'No AI-generated recommendations',
      suggestion: 'AI insights may have failed - consider manual review',
    });
  } else {
    checks.push({
      passed: true,
      checkName: 'RECOMMENDATIONS_PRESENT',
      severity: 'info',
      message: `${recommendations.length} recommendations generated`,
    });
  }

  return checks;
}

// =============================================================================
// PRE-LAUNCH DATA INTEGRITY VALIDATOR
// Runs before ANY deck is saved/published. Catches every data issue.
// =============================================================================

/**
 * Comprehensive pre-launch validator that ensures deck data integrity.
 * This is the final gate — if this fails, the deck MUST NOT be published.
 */
export function validateDeckDataIntegrity(
  deckContent: Record<string, unknown>,
  supermetricsData: Record<string, unknown> | null,
  dateRangeStart: string,
  dateRangeEnd: string,
): QACheckResult[] {
  const checks: QACheckResult[] = [];
  const hero = deckContent.hero as Record<string, unknown> | undefined;
  const googleAds = deckContent.googleAds as Record<string, unknown> | undefined;
  const metaAds = deckContent.metaAds as Record<string, unknown> | undefined;
  const dataSourceLog = deckContent._dataSourceLog as Record<string, string> | undefined;

  // ── CHECK 1: Hero totals match sum of platform breakdowns ──
  const heroSpend = Number(hero?.totalSpend ?? 0);
  const platformSpendSum = Number(googleAds?.spend ?? 0) + Number(metaAds?.spend ?? 0)
    + Number((deckContent.tiktokAds as any)?.spend ?? 0)
    + Number((deckContent.bingAds as any)?.spend ?? 0)
    + Number((deckContent.linkedinAds as any)?.spend ?? 0);

  // If we have adPlatforms, use that as the authoritative total instead
  const adPlatforms = deckContent.adPlatforms as any[] | undefined;
  const adPlatformSpendSum = adPlatforms?.reduce((sum: number, p: any) => sum + (p.spend ?? 0), 0) ?? 0;
  const referenceSpend = adPlatformSpendSum > 0 ? adPlatformSpendSum : platformSpendSum;

  if (heroSpend > 0 && referenceSpend > 0) {
    const spendDrift = Math.abs(heroSpend - referenceSpend);
    const driftPct = (spendDrift / Math.max(heroSpend, referenceSpend)) * 100;
    if (driftPct > 5) {
      checks.push({
        passed: false,
        checkName: 'HERO_SPEND_MATCHES_PLATFORMS',
        severity: 'critical',
        message: `Hero total spend ($${heroSpend.toFixed(2)}) differs from platform sum ($${referenceSpend.toFixed(2)}) by ${driftPct.toFixed(1)}%`,
        suggestion: 'Check for double-counting or missing platform data',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'HERO_SPEND_MATCHES_PLATFORMS',
        severity: 'info',
        message: `Hero spend matches platform breakdown (drift: ${driftPct.toFixed(1)}%)`,
      });
    }
  }

  // ── CHECK 2: No fabricated data (no hardcoded fallback sources) ──
  if (dataSourceLog) {
    const fabricatedMetrics = Object.entries(dataSourceLog)
      .filter(([, source]) => source.includes('fabricated') || source.includes('hardcoded'));
    if (fabricatedMetrics.length > 0) {
      checks.push({
        passed: false,
        checkName: 'NO_FABRICATED_DATA',
        severity: 'critical',
        message: `${fabricatedMetrics.length} metrics used fabricated data: ${fabricatedMetrics.map(([k]) => k).join(', ')}`,
        suggestion: 'All metrics must come from real data sources',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'NO_FABRICATED_DATA',
        severity: 'info',
        message: 'All metrics sourced from real data',
      });
    }

    // Log how many metrics came from each source type
    const sourceCounts: Record<string, number> = {};
    for (const source of Object.values(dataSourceLog)) {
      const baseSource = source.replace(/ \(zero\)$/, '');
      sourceCounts[baseSource] = (sourceCounts[baseSource] ?? 0) + 1;
    }
    checks.push({
      passed: true,
      checkName: 'DATA_SOURCE_SUMMARY',
      severity: 'info',
      message: `Data sources: ${Object.entries(sourceCounts).map(([s, c]) => `${s}=${c}`).join(', ')}`,
      details: sourceCounts,
    });
  }

  // ── CHECK 3: Spend/Conversions/CPA consistency ──
  const gSpend = Number(googleAds?.spend ?? 0);
  const gConv = Number(googleAds?.conversions ?? 0);
  const gCpa = Number(googleAds?.cpa ?? 0);
  if (gSpend > 0 && gConv > 0 && gCpa > 0) {
    const expectedCpa = gSpend / gConv;
    const cpaDrift = Math.abs(gCpa - expectedCpa);
    const cpaDriftPct = (cpaDrift / expectedCpa) * 100;
    if (cpaDriftPct > 10) {
      checks.push({
        passed: false,
        checkName: 'GOOGLE_CPA_CONSISTENT',
        severity: 'warning',
        message: `Google CPA ($${gCpa.toFixed(2)}) doesn't match spend/conversions ($${expectedCpa.toFixed(2)}) — ${cpaDriftPct.toFixed(1)}% drift`,
        suggestion: 'CPA may have been pulled from a different data source than spend/conversions',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'GOOGLE_CPA_CONSISTENT',
        severity: 'info',
        message: `Google CPA is consistent with spend/conversions`,
      });
    }
  }

  const mSpend = Number(metaAds?.spend ?? 0);
  const mConv = Number(metaAds?.conversions ?? 0);
  const mCpa = Number(metaAds?.cpa ?? 0);
  if (mSpend > 0 && mConv > 0 && mCpa > 0) {
    const expectedCpa = mSpend / mConv;
    const cpaDrift = Math.abs(mCpa - expectedCpa);
    const cpaDriftPct = (cpaDrift / expectedCpa) * 100;
    if (cpaDriftPct > 10) {
      checks.push({
        passed: false,
        checkName: 'META_CPA_CONSISTENT',
        severity: 'warning',
        message: `Meta CPA ($${mCpa.toFixed(2)}) doesn't match spend/conversions ($${expectedCpa.toFixed(2)}) — ${cpaDriftPct.toFixed(1)}% drift`,
        suggestion: 'CPA may have been pulled from a different data source than spend/conversions',
      });
    } else {
      checks.push({
        passed: true,
        checkName: 'META_CPA_CONSISTENT',
        severity: 'info',
        message: `Meta CPA is consistent with spend/conversions`,
      });
    }
  }

  // ── CHECK 4: CTR sanity (must be 0-100%) ──
  for (const [name, ctr] of [['Google CTR', Number(googleAds?.ctr ?? 0)], ['Meta CTR', Number(metaAds?.ctr ?? 0)]] as [string, number][]) {
    if (ctr > 100) {
      checks.push({
        passed: false,
        checkName: `${name.replace(' ', '_').toUpperCase()}_RANGE`,
        severity: 'critical',
        message: `${name} is ${ctr}% — impossible value, likely wrong unit`,
        suggestion: 'CTR should be 0-100%. Check if source returns decimal (0.05) vs percentage (5)',
      });
    } else if (ctr > 30) {
      checks.push({
        passed: false,
        checkName: `${name.replace(' ', '_').toUpperCase()}_RANGE`,
        severity: 'warning',
        message: `${name} is ${ctr}% — unusually high, verify accuracy`,
      });
    }
  }

  // ── CHECK 5: Period-over-period sanity ──
  const changes = hero?.changes as Record<string, number | null> | undefined;
  if (changes) {
    for (const [metric, pctChange] of Object.entries(changes)) {
      if (pctChange !== null && Math.abs(pctChange) > 500) {
        checks.push({
          passed: false,
          checkName: `CHANGE_${metric.toUpperCase()}_SANITY`,
          severity: 'warning',
          message: `${metric} changed by ${pctChange.toFixed(0)}% period-over-period — verify this is accurate`,
          suggestion: 'Changes over 500% may indicate data mismatch between periods',
        });
      }
    }
  }

  // ── CHECK 6: Zero-value audit — flag if ALL major metrics are zero ──
  const allZero = heroSpend === 0 && Number(hero?.totalClicks ?? 0) === 0
    && Number(hero?.totalLeads ?? 0) === 0 && Number(hero?.totalImpressions ?? 0) === 0;
  if (allZero && supermetricsData && Object.keys(supermetricsData).length > 0) {
    checks.push({
      passed: false,
      checkName: 'ALL_METRICS_ZERO',
      severity: 'critical',
      message: 'All hero metrics are zero despite having Supermetrics data — data extraction likely failed',
      suggestion: 'Check Supermetrics API responses and summary field names',
    });
  } else if (allZero) {
    checks.push({
      passed: false,
      checkName: 'ALL_METRICS_ZERO',
      severity: 'warning',
      message: 'All hero metrics are zero — deck will appear empty',
      suggestion: 'Verify data sources are configured for this client',
    });
  }

  // ── CHECK 7: Supermetrics data completeness (if provided) ──
  if (supermetricsData) {
    for (const [key, data] of Object.entries(supermetricsData)) {
      const smData = data as any;
      if (!smData?.summary) {
        checks.push({
          passed: false,
          checkName: `SM_${key.toUpperCase()}_HAS_SUMMARY`,
          severity: 'critical',
          message: `Supermetrics platform "${key}" has no summary object — metrics will all be zero`,
          suggestion: 'Check Supermetrics API response structure',
        });
      } else {
        const summaryKeys = Object.keys(smData.summary);
        if (summaryKeys.length === 0) {
          checks.push({
            passed: false,
            checkName: `SM_${key.toUpperCase()}_SUMMARY_EMPTY`,
            severity: 'critical',
            message: `Supermetrics "${key}" summary is empty — no metrics available`,
          });
        }
      }
    }
  }

  // ── CHECK 8: Spend without conversions or vice versa ──
  if (gSpend > 100 && gConv === 0) {
    checks.push({
      passed: false,
      checkName: 'GOOGLE_SPEND_NO_CONVERSIONS',
      severity: 'warning',
      message: `Google Ads spent $${gSpend.toFixed(2)} but shows 0 conversions — verify conversion tracking`,
      suggestion: 'May indicate conversion tracking is broken or data source mismatch',
    });
  }
  if (mSpend > 100 && mConv === 0) {
    checks.push({
      passed: false,
      checkName: 'META_SPEND_NO_CONVERSIONS',
      severity: 'warning',
      message: `Meta Ads spent $${mSpend.toFixed(2)} but shows 0 conversions — verify conversion tracking`,
      suggestion: 'May indicate conversion pixel is broken or data source mismatch',
    });
  }

  // ── CHECK 9: CPC sanity (should never exceed total spend) ──
  const gCpc = Number(googleAds?.cpc ?? 0);
  const mCpc = Number(metaAds?.cpc ?? 0);
  if (gCpc > gSpend && gSpend > 0) {
    checks.push({
      passed: false,
      checkName: 'GOOGLE_CPC_SANITY',
      severity: 'critical',
      message: `Google CPC ($${gCpc.toFixed(2)}) exceeds total spend ($${gSpend.toFixed(2)}) — impossible`,
    });
  }
  if (mCpc > mSpend && mSpend > 0) {
    checks.push({
      passed: false,
      checkName: 'META_CPC_SANITY',
      severity: 'critical',
      message: `Meta CPC ($${mCpc.toFixed(2)}) exceeds total spend ($${mSpend.toFixed(2)}) — impossible`,
    });
  }

  // ── CHECK 10: Date range in content matches requested ──
  // (Catches cases where cached/stale data from a different period slips in)
  const adPlatformsList = deckContent.adPlatforms as any[] | undefined;
  if (adPlatformsList) {
    for (const platform of adPlatformsList) {
      if (platform.dailyData && Array.isArray(platform.dailyData) && platform.dailyData.length > 0) {
        const firstDate = platform.dailyData[0]?.date;
        const lastDate = platform.dailyData[platform.dailyData.length - 1]?.date;
        if (firstDate && lastDate) {
          const requestedStart = new Date(dateRangeStart).getTime();
          const requestedEnd = new Date(dateRangeEnd).getTime();
          const dataStart = new Date(firstDate).getTime();
          const dataEnd = new Date(lastDate).getTime();

          // Allow 2 days tolerance (weekends, delayed reporting)
          const tolerance = 2 * 24 * 60 * 60 * 1000;
          if (dataStart > requestedStart + tolerance || dataEnd < requestedEnd - tolerance) {
            checks.push({
              passed: false,
              checkName: `DATE_RANGE_MATCH_${platform.key?.toUpperCase()}`,
              severity: 'warning',
              message: `${platform.label} daily data (${firstDate} to ${lastDate}) doesn't fully cover requested range (${dateRangeStart} to ${dateRangeEnd})`,
              suggestion: 'Data may be stale or from a different reporting period',
            });
          }
        }
      }
    }
  }

  // ── CHECK 11: Narrative/insights reference real data ──
  const narrative = deckContent.narrative as Record<string, unknown> | undefined;
  if (narrative) {
    const wins = narrative.wins as string[] | undefined;
    if (wins && wins.length > 0 && allZero) {
      checks.push({
        passed: false,
        checkName: 'NARRATIVE_MATCHES_DATA',
        severity: 'critical',
        message: 'AI generated wins/narrative but all metrics are zero — narrative is fabricated',
        suggestion: 'Narrative should be regenerated after data issues are fixed',
      });
    }
  }

  return checks;
}

/**
 * Generate final QA report from all checks
 */
export function generateQAReport(checks: QACheckResult[], stage: string): QAReport {
  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;
  const warnings = checks.filter(c => c.severity === 'warning' && !c.passed).length;
  
  // Calculate score: start at 100, deduct for issues
  let score = 100;
  for (const check of checks) {
    if (!check.passed) {
      if (check.severity === 'critical') score -= 20;
      else if (check.severity === 'warning') score -= 5;
    }
  }
  score = Math.max(0, score);

  return {
    overallPassed: criticalFailures === 0,
    score,
    criticalFailures,
    warnings,
    checks,
    timestamp: new Date().toISOString(),
    stage,
  };
}

/**
 * Format QA report for logging
 */
export function formatQAReportForLog(report: QAReport): string {
  const lines = [
    `\n=== QA REPORT: ${report.stage} ===`,
    `Score: ${report.score}/100 | Passed: ${report.overallPassed ? 'YES' : 'NO'}`,
    `Critical Failures: ${report.criticalFailures} | Warnings: ${report.warnings}`,
    `---`,
  ];

  for (const check of report.checks) {
    const icon = check.passed ? '✓' : (check.severity === 'critical' ? '✗' : '⚠');
    lines.push(`${icon} [${check.severity.toUpperCase()}] ${check.checkName}: ${check.message}`);
    if (check.suggestion && !check.passed) {
      lines.push(`  → Suggestion: ${check.suggestion}`);
    }
  }

  lines.push(`=== END QA REPORT ===\n`);
  return lines.join('\n');
}
