import { useEffect, useRef, type ComponentProps } from "react";
import { RetroScreen } from "./RetroScreen";
import {
  useRetroScreenAnsiPlayer,
  type RetroScreenAnsiPlayerState
} from "./useRetroScreenAnsiPlayer";
import type { RetroScreenAnsiByteChunk } from "../core/ansi/player";

export type RetroScreenAnsiPlayerProps = Omit<
  ComponentProps<typeof RetroScreen>,
  "mode" | "value" | "gridMode" | "rows" | "cols"
> & {
  byteStream?: readonly RetroScreenAnsiByteChunk[];
  rows: number;
  cols: number;
  frameDelayMs?: number;
  loop?: boolean;
  complete?: boolean;
  loadingValue?: string;
  onPlaybackStateChange?: (state: RetroScreenAnsiPlayerState) => void;
};

export function RetroScreenAnsiPlayer({
  byteStream = [],
  rows,
  cols,
  frameDelayMs,
  loop,
  complete,
  loadingValue,
  onPlaybackStateChange,
  ...screenProps
}: RetroScreenAnsiPlayerProps) {
  const playbackState = useRetroScreenAnsiPlayer({
    byteStream,
    rows,
    cols,
    frameDelayMs,
    loop,
    complete,
    loadingValue
  });
  const notifiedPlaybackStateRef = useRef<RetroScreenAnsiPlayerState | null>(null);

  useEffect(() => {
    const previousPlaybackState = notifiedPlaybackStateRef.current;
    const changed =
      previousPlaybackState === null ||
      previousPlaybackState.displayValue !== playbackState.displayValue ||
      previousPlaybackState.frameIndex !== playbackState.frameIndex ||
      previousPlaybackState.frameCount !== playbackState.frameCount ||
      previousPlaybackState.isComplete !== playbackState.isComplete ||
      previousPlaybackState.isStreaming !== playbackState.isStreaming;

    if (!changed) {
      return;
    }

    notifiedPlaybackStateRef.current = playbackState;
    onPlaybackStateChange?.(playbackState);
  }, [onPlaybackStateChange, playbackState]);

  return (
    <RetroScreen
      {...screenProps}
      mode="value"
      value={playbackState.displayValue}
      gridMode="static"
      rows={rows}
      cols={cols}
    />
  );
}
