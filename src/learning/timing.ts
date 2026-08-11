import type { TimingSample } from "./types";

export class ReadingTimer {
  private startedAt: number | null = null;
  private voiceStartedAt: number | null = null;
  private voiceEndedAt: number | null = null;
  private pauseCount = 0;
  private retryCount = 0;

  start(now = performance.now()): void {
    this.startedAt = now;
    this.voiceStartedAt = null;
    this.voiceEndedAt = null;
    this.pauseCount = 0;
    this.retryCount = 0;
  }

  markVoiceStart(now = performance.now()): void { this.requireStarted(); if (this.voiceStartedAt === null) this.voiceStartedAt = now; }
  markVoiceEnd(now = performance.now()): void { this.requireStarted(); this.voiceEndedAt = now; }
  markPause(): void { this.pauseCount += 1; }
  markRetry(): void { this.retryCount += 1; }

  finish(now = performance.now()): TimingSample {
    this.requireStarted();
    const voiceStart = this.voiceStartedAt ?? this.startedAt!;
    const voiceEnd = this.voiceEndedAt ?? now;
    return {
      preparationMs: Math.max(0, voiceStart - this.startedAt!),
      readingMs: Math.max(0, voiceEnd - voiceStart),
      totalMs: Math.max(0, now - this.startedAt!),
      pauseCount: this.pauseCount,
      retryCount: this.retryCount,
    };
  }

  private requireStarted(): void { if (this.startedAt === null) throw new Error("ReadingTimer must be started first"); }
}
