import { useState, useEffect, useRef } from 'react';
import { FrictionDetector } from '../widget/FrictionDetector';
import { Signal, FrictionType } from '../types';

interface UseRecoverySessionReturn {
  sessionId: string | null;
  frictionType: FrictionType | null;
  signals: Signal[];
  isLoading: boolean;
  injectSignal: (type: Signal['type']) => void;
  logOutcome: (outcome: 'recovered' | 'abandoned' | 'escalated') => Promise<void>;
}

/**
 * useRecoverySession — Manages the full CartSave session lifecycle:
 * 1. Starts a backend session on mount
 * 2. Attaches FrictionDetector to DOM
 * 3. Sends signals to backend /api/friction/detect
 * 4. Tracks detected friction type
 */
export function useRecoverySession(shopDomain: string): UseRecoverySessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [frictionType, setFrictionType] = useState<FrictionType | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const detectorRef = useRef<FrictionDetector | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Start session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const startSession = async () => {
      try {
        const res = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shopDomain,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) {
          setSessionId(data.sessionId);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[CartSave] Session start failed:', err);
        if (mounted) setIsLoading(false);
      }
    };

    startSession();
    return () => { mounted = false; };
  }, [shopDomain]);

  // ─── Start friction detection after session is ready ────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const handleSignals = (newSignals: Signal[]) => {
      setSignals(newSignals);

      // Debounce API calls — wait 1s of signal stability before sending
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        sendSignals(sessionId, newSignals);
      }, 1000);
    };

    const detector = new FrictionDetector(handleSignals);
    detector.start();
    detectorRef.current = detector;

    return () => {
      detector.stop();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sessionId]);

  const sendSignals = async (sid: string, sigs: Signal[]) => {
    try {
      const res = await fetch('/api/friction/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, signals: sigs }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.shouldTrigger && data.frictionType) {
        setFrictionType(data.frictionType as FrictionType);
      }
    } catch (err) {
      console.warn('[CartSave] Friction detect failed:', err);
    }
  };

  // Programmatic signal injection (for demo/testing buttons)
  const injectSignal = (type: Signal['type']) => {
    detectorRef.current?.injectSignal(type);
  };

  const logOutcome = async (outcome: 'recovered' | 'abandoned' | 'escalated') => {
    if (!sessionId) return;
    try {
      await fetch('/api/session/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, outcome }),
      });
    } catch {}
  };

  return { sessionId, frictionType, signals, isLoading, injectSignal, logOutcome };
}
