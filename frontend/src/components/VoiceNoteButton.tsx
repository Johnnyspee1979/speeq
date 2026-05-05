/**
 * VoiceNoteButton — tik, spreek, klaar. Geen typen op de bouwvloer.
 * Gebruikt Web Speech API (gratis, werkt op iOS Safari 13+ en Android Chrome).
 */

import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface VoiceNoteButtonProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function VoiceNoteButton({ onResult, disabled }: VoiceNoteButtonProps) {
  const { theme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const startListening = useCallback(() => {
    if (!isSupported) return;
    setError(null);

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'nl-NL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) onResult(transcript);
    };

    recognition.onerror = () => {
      setError('Spraak niet herkend');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  if (!isSupported) return null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.button,
          { borderColor: isListening ? theme.colors.danger : theme.colors.border },
          isListening && { backgroundColor: 'rgba(220,38,38,0.08)' },
          disabled && { opacity: 0.4 },
        ]}
        onPress={isListening ? stopListening : startListening}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text style={[styles.mic, { color: isListening ? theme.colors.danger : theme.colors.textSecondary }]}>
          {isListening ? '⏹' : '🎤'}
        </Text>
        <Text style={[styles.label, { color: isListening ? theme.colors.danger : theme.colors.textSecondary }]}>
          {isListening ? 'Stop' : 'Spraak'}
        </Text>
      </TouchableOpacity>
      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.warning }]}>{error}</Text>
      ) : null}
      {isListening ? (
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Luistert... spreek je notitie in
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  mic: {
    fontSize: 15,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
