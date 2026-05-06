/**
 * SignaturePad — canvas-gebaseerde handtekeningveld voor web/PWA.
 *
 * Gebruik:
 *   <SignaturePad onSave={(dataUrl) => setSig(dataUrl)} theme={theme} />
 *
 * Geeft een data:image/png;base64,... terug via onSave.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  label?: string;
  subLabel?: string;
  theme: {
    colors: {
      background: string;
      surface: string;
      border: string;
      textPrimary: string;
      textSecondary: string;
      accent: string;
    };
  };
}

export default function SignaturePad({
  onSave,
  onClear,
  label = 'Handtekening',
  subLabel,
  theme,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [hasSig, setHasSig] = useState(false);
  const [saved, setSaved] = useState(false);

  // Stel canvas in op correcte DPR voor scherpte
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0];
      if (!t) return null;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    setSaved(false);
    const pos = getPos(e);
    lastPos.current = pos;
    if (pos) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    if (!pos || !lastPos.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSig(true);
  }, []);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  // Attach events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasSig(false);
    setSaved(false);
    onClear?.();
  }, [onClear]);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSig) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    setSaved(true);
  }, [hasSig, onSave]);

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}

      {/* Canvas wrapped in native View voor border styling */}
      <View style={styles.canvasWrap}>
        {/* @ts-ignore — canvas is web-only */}
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 140,
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none',
            borderRadius: 10,
            background: '#fafafa',
          }}
        />
        {!hasSig ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Text style={styles.placeholderText}>✍️  Teken hier je handtekening</Text>
          </View>
        ) : null}
      </View>

      {/* Knoppen */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={handleClear}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, { color: theme.colors.textSecondary }]}>Wissen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, !hasSig && styles.btnDisabled]}
          onPress={handleSave}
          disabled={!hasSig}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>
            {saved ? '✓ Handtekening opgeslagen' : 'Handtekening bevestigen'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: SignaturePadProps['theme']) =>
  StyleSheet.create({
    container: {
      marginBottom: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    subLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    canvasWrap: {
      position: 'relative',
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      backgroundColor: '#fafafa',
    },
    placeholder: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderText: {
      fontSize: 13,
      color: '#bbb',
      fontWeight: '500',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    btn: {
      flex: 1,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnGhost: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: 'transparent',
    },
    btnPrimary: {
      backgroundColor: theme.colors.accent,
    },
    btnDisabled: {
      opacity: 0.4,
    },
    btnText: {
      fontSize: 13,
      fontWeight: '700',
    },
  });
