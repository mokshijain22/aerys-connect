'use client';

import { useEffect, useRef, useState } from 'react';

const VIOLET = '#6C5CE7';
const RED = '#E24B4A';
const MUTED = '#6B7280';

/**
 * A mic button that appends spoken text to whatever value it's paired with.
 * Uses the browser's built-in Web Speech API (Chrome/Edge support it well;
 * Safari/Firefox support is limited — the button just won't appear there).
 *
 * Usage (inside a textarea's label/wrapper):
 *   <VoiceInput
 *     lang={hindiSelected ? 'hi-IN' : 'en-IN'}
 *     onResult={(text) => setForm(f => ({ ...f, complaintText: (f.complaintText + ' ' + text).trim() }))}
 *   />
 */
export function VoiceInput({ onResult, lang = 'en-IN' }: { onResult: (text: string) => void; lang?: string }) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = lang;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    };
  }, [lang, onResult]);

  if (!supported) return null;

  const toggle = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.lang = lang;
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // start() throws if already started — ignore
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Stop recording' : 'Speak your complaint'}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
      style={{
        backgroundColor: listening ? 'rgba(226,75,74,0.1)' : 'rgba(108,92,231,0.08)',
        color: listening ? RED : VIOLET,
      }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: listening ? RED : VIOLET,
          animation: listening ? 'voicePulse 1s ease-in-out infinite' : 'none',
        }}
      />
      {listening ? 'Listening…' : '🎤 Speak'}
      <style jsx>{`
        @keyframes voicePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>
    </button>
  );
}