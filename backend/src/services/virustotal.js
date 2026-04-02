import fetch from 'node-fetch';
import logger from '../logger.js';

const API_KEY = process.env.VIRUSTOTAL_API_KEY || '';
const ENDPOINT = 'https://www.virustotal.com/api/v3/urls';
const TIMEOUT_MS = 5000;

export async function checkVirusTotal(url) {
  if (!API_KEY) {
    logger.warn('VirusTotal API key not configured');
    return { listed: false, source: 'virustotal', note: 'api_key_missing' };
  }

  try {
    // First, submit URL for analysis
    const submitForm = new URLSearchParams();
    submitForm.append('url', url);

    const submitRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-apikey': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: submitForm
    });

    if (!submitRes.ok) {
      logger.warn({ status: submitRes.status }, 'VirusTotal submit failed');
      return { listed: false, source: 'virustotal', note: 'submit_error' };
    }

    const submitData = await submitRes.json();
    const analysisId = submitData?.data?.id;

    if (!analysisId) {
      return { listed: false, source: 'virustotal', note: 'no_analysis_id' };
    }

    // Wait a moment for analysis to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get analysis results
    const analysisUrl = `https://www.virustotal.com/api/v3/analyses/${analysisId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const analysisRes = await fetch(analysisUrl, {
      headers: { 'x-apikey': API_KEY },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!analysisRes.ok) {
      logger.warn({ status: analysisRes.status }, 'VirusTotal analysis fetch failed');
      return { listed: false, source: 'virustotal', note: 'analysis_error' };
    }

    const analysisData = await analysisRes.json();
    const stats = analysisData?.data?.attributes?.stats;

    if (!stats) {
      return { listed: false, source: 'virustotal', note: 'no_stats' };
    }

    // Calculate threat score based on AV detections
    const totalScans = stats.harmless + stats.malicious + stats.suspicious + stats.timeout + stats.undetected;
    const threatRatio = stats.malicious / totalScans;

    const listed = threatRatio >= 0.1; // 10% or more AV engines detect as malicious
    const confidence = Math.round(threatRatio * 100);

    const details = {
      malicious: stats.malicious,
      suspicious: stats.suspicious,
      harmless: stats.harmless,
      total: totalScans,
      threatRatio: threatRatio
    };

    return {
      listed,
      details,
      source: 'virustotal',
      confidence
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('VirusTotal API request timeout');
      return { listed: false, source: 'virustotal', note: 'timeout' };
    }
    logger.error({ err: String(err) }, 'VirusTotal check failed');
    return { listed: false, source: 'virustotal', note: 'exception' };
  }
}