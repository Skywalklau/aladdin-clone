type SentimentKey = 'strongly bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly bearish'

export interface SentimentMeta {
  color: string
  bg:    string
  dot:   string
  label: string
}

export const SENTIMENT_META: Record<SentimentKey, SentimentMeta> = {
  'strongly bullish': { color: '#4CAF85', bg: 'rgba(76,175,133,0.08)',  dot: '#4CAF85', label: 'Strongly Bullish' },
  'bullish':          { color: '#4CAF85', bg: 'rgba(76,175,133,0.05)',  dot: '#4CAF85', label: 'Bullish'          },
  'neutral':          { color: '#C9A84C', bg: 'rgba(201,168,76,0.08)', dot: '#C9A84C', label: 'Neutral'          },
  'bearish':          { color: '#E05252', bg: 'rgba(224,82,82,0.05)',  dot: '#E05252', label: 'Bearish'          },
  'strongly bearish': { color: '#E05252', bg: 'rgba(224,82,82,0.10)', dot: '#E05252', label: 'Strongly Bearish'  },
}

export const getSentimentMeta = (sentiment: string): SentimentMeta =>
  SENTIMENT_META[sentiment.toLowerCase() as SentimentKey] ?? {
    color: '#8BA4BE', bg: 'rgba(139,164,190,0.06)', dot: '#8BA4BE', label: sentiment,
  }