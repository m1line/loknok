export type CallKind = 'audio' | 'video';

export type CallSignal =
  | { type: 'invite'; callId: string; from: string; fromName: string; kind: CallKind }
  | { type: 'accept'; callId: string; from: string }
  | { type: 'reject'; callId: string; from: string }
  | { type: 'offer'; callId: string; from: string; sdp: string }
  | { type: 'answer'; callId: string; from: string; sdp: string }
  | { type: 'ice'; callId: string; from: string; candidate: RTCIceCandidateInit }
  | { type: 'end'; callId: string; from: string };

export const CALL_RING_TIMEOUT_MS = 40_000;

const turnUrl = import.meta.env.VITE_TURN_URL;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(turnUrl
    ? [
        {
          urls: turnUrl,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_CREDENTIAL,
        },
      ]
    : []),
];

export function callChannelName(profileId: string): string {
  return `calls:${profileId}`;
}
