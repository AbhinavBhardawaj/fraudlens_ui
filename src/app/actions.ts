
"use server";

import type { PredictionResult, FeatureImportance, Transaction } from "@/lib/definitions";
import { summarizeResults, type SummarizeResultsInput } from "@/ai/flows/summarize-results-flow";
import { askOnData, type AskOnDataInput } from "@/ai/flows/ask-on-data-flow";

// This function handles a single prediction by calling the live Django model.
export async function predictFraud(data: Transaction): Promise<{ result?: PredictionResult; featureImportance?: FeatureImportance[]; error?: string }> {
  // We expect Time, Amount, and V1-V28, so 30 fields total.
  if (!data || Object.keys(data).length < 30) {
    return { error: "Incomplete transaction data provided." };
  }

  try {
    const djangoEndpoint = process.env.NEXT_PUBLIC_DJANGO_API_ENDPOINT;

    if (!djangoEndpoint) {
      throw new Error("The Django API endpoint is not configured. Please set NEXT_PUBLIC_DJANGO_API_ENDPOINT in your environment variables.");
    }

    const response = await fetch(djangoEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
       const errorBody = await response.text();
      // NOTE: Remember to configure CORS on your Django backend to allow requests
      // from your Next.js frontend's domain. A popular package for this is `django-cors-headers`.
      throw new Error(`API call failed with status: ${response.status}. Body: ${errorBody}`);
    }

    const modelPrediction = await response.json();
    console.log("Response from Django:", JSON.stringify(modelPrediction, null, 2));
    
    // Robustly find the risk score key
    const riskScoreKey = Object.keys(modelPrediction).find(key => key.toLowerCase().includes('score'));
    if (!riskScoreKey) {
        throw new Error("The backend response did not include a 'risk_score' or similar field.");
    }
    const riskScoreValue = modelPrediction[riskScoreKey];

    const result: PredictionResult = {
      id: `txn_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      prediction: modelPrediction.prediction === 1 ? 'Fraudulent' : 'Not Fraudulent',
      riskScore: parseFloat(riskScoreValue),
    };
    
    // The new API spec does not include feature importance, so we return an empty array.
    const featureImportance: FeatureImportance[] = [];

    return { result, featureImportance };

  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during prediction.";
    return { error: errorMessage };
  }
}

// This function handles batch prediction from a CSV.
export async function batchPredictFraud(fileName: string): Promise<{ results?: PredictionResult[]; featureImportance?: FeatureImportance[]; error?: string }> {
   await new Promise((resolve) => setTimeout(resolve, 2500)); // Simulate processing time

  if (!fileName) {
    return { error: "No file provided for batch prediction." };
  }
  
  try {
    const results: PredictionResult[] = [];
    const numDays = 7;
    const today = new Date();

    for (let i = 0; i < numDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const transactionsPerDay = Math.floor(Math.random() * 5) + 3; // 3 to 7 transactions per day

        for (let j = 0; j < transactionsPerDay; j++) {
            const riskScore = Math.random() * 0.001;
            const prediction: 'Fraudulent' | 'Not Fraudulent' = riskScore > 0.0008 ? 'Fraudulent' : 'Not Fraudulent';
            results.push({
                id: `batch_${i}_${j}_${Math.random().toString(36).substr(2, 9)}`,
                date: dateString,
                Time: (numDays - i -1) * 86400 + Math.random() * 86400,
                Amount: Math.random() * 1000,
                V1: Math.random() * 10,
                V2: Math.random() * 10,
                V3: Math.random() * 10,
                V4: Math.random() * 10,
                V5: Math.random() * 10,
                V6: Math.random() * 10,
                V7: Math.random() * 10,
                V8: Math.random() * 10,
                V9: Math.random() * 10,
                V10: Math.random() * 10,
                prediction,
                riskScore: riskScore,
            });
        }
    }


     const MOCK_FEATURE_IMPORTANCE: FeatureImportance[] = [
      { feature: 'V17', importance: 0.18 },
      { feature: 'V14', importance: 0.15 },
      { feature: 'V12', importance: 0.12 },
      { feature: 'V10', importance: 0.10 },
      { feature: 'V11', importance: 0.09 },
      { feature: 'V16', importance: 0.08 },
      { feature: 'V7', importance: 0.07 },
      { feature: 'V4', importance: 0.06 },
      { feature: 'V3', importance: 0.05 },
      { feature: 'V9', importance: 0.04 },
    ];


    return { results, featureImportance: MOCK_FEATURE_IMPORTANCE };
  } catch (e) {
    console.error(e);
    const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred during batch processing.";
    return { error: errorMessage };
  }
}

export async function getSummary(
  results: PredictionResult[]
): Promise<{ summary?: string; error?: string }> {
  try {
    const input: SummarizeResultsInput = {
      results: results.map((r) => ({
        id: r.id,
        prediction: r.prediction,
        riskScore: r.riskScore,
        Time: Number(r.Time),
        Amount: Number(r.Amount),
        date: r.date !== undefined ? String(r.date) : undefined,
      })),
    };
    const { summary } = await summarizeResults(input);
    return { summary };
  } catch (e) {
    console.error(e);
    return { error: "Failed to generate summary." };
  }
}

export async function getAnswer(
  question: string,
  results: PredictionResult[]
): Promise<{ answer?: string; error?: string }> {
  if (results.length === 0) {
    return { answer: "I can't answer questions until some transaction data is available. Please run a prediction first." };
  }
  if (!question) {
    return { error: "Please provide a question." };
  }
  try {
    const input: AskOnDataInput = {
      question,
      results: results.map((r) => ({
        id: r.id,
        prediction: r.prediction,
        riskScore: r.riskScore,
        Time: Number(r.Time),
        Amount: Number(r.Amount),
        date: r.date !== undefined ? String(r.date) : undefined,
        V1: Number(r.V1), V2: Number(r.V2), V3: Number(r.V3),
        V4: Number(r.V4), V5: Number(r.V5), V6: Number(r.V6),
        V7: Number(r.V7), V8: Number(r.V8), V9: Number(r.V9),
        V10: Number(r.V10), V11: Number(r.V11), V12: Number(r.V12),
        V13: Number(r.V13), V14: Number(r.V14), V15: Number(r.V15),
        V16: Number(r.V16), V17: Number(r.V17), V18: Number(r.V18),
        V19: Number(r.V19), V20: Number(r.V20), V21: Number(r.V21),
        V22: Number(r.V22), V23: Number(r.V23), V24: Number(r.V24),
        V25: Number(r.V25), V26: Number(r.V26), V27: Number(r.V27),
        V28: Number(r.V28),
      })),
    };
    const { answer } = await askOnData(input);
    return { answer };
  } catch (e) {
    console.error(e);
    return { error: "Failed to get an answer from the AI." };
  }
}
