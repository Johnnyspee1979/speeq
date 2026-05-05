declare module 'react-native-stopwatch-timer' {
  import type { ComponentType } from 'react';
  import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

  export type StopwatchTimerOptions = {
    container?: StyleProp<ViewStyle>;
    text?: StyleProp<TextStyle>;
  };

  export type TimerProps = {
    start?: boolean;
    reset?: boolean;
    msecs?: boolean;
    options?: StopwatchTimerOptions;
    handleFinish?: () => void;
    totalDuration: number;
    getTime?: (time: string) => void;
    getMsecs?: (time: number) => void;
  };

  export const Timer: ComponentType<TimerProps>;
  export const Stopwatch: ComponentType<Record<string, unknown>>;
}
