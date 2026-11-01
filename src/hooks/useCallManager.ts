import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CALL_RING_TIMEOUT_MS, ICE_SERVERS, callChannelName, type CallKind, type CallSignal } from '@/lib/calls';

export type CallPhase = 'outgoing' | 'incoming' | 'connecting' | 'active';

export interface ActiveCall {
  callId: string;
  kind: CallKind;
  phase: CallPhase;
  peer: { id: string; name: string };
  startedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
}

interface CallMe {
  id: string;
  display_name: string;
}

type InviteSignal = Extract<CallSignal, { type: 'invite' }>;

function acquireMedia(kind: CallKind): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: kind === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
}

function openSignalChannel(name: string, onSignal?: (signal: CallSignal) => void): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    const channel = supabase.channel(name, { config: { broadcast: { self: false } } });
    if (onSignal) {
      channel.on('broadcast', { event: 'signal' }, ({ payload }) => onSignal(payload as CallSignal));
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve(channel);
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
    });
  });
}

export function useCallManager(me: CallMe, onNotice: (text: string) => void) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callRef = useRef<ActiveCall | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalChannelRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  function patchCall(patch: Partial<ActiveCall>) {
    const next = callRef.current ? { ...callRef.current, ...patch } : null;
    callRef.current = next;
    setCall(next);
  }

  function clearTimer() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function teardown() {
    clearTimer();
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((track) => track.stop());
    localRef.current = null;
    remoteRef.current?.getTracks().forEach((track) => track.stop());
    remoteRef.current = null;
    pendingIceRef.current = [];
    remoteSetRef.current = false;
    if (signalChannelRef.current) void supabase.removeChannel(signalChannelRef.current);
    signalChannelRef.current = null;
    callRef.current = null;
    setCall(null);
    setLocalStream(null);
    setRemoteStream(null);
  }

  async function sendSignal(signal: CallSignal) {
    await signalChannelRef.current?.send({ type: 'broadcast', event: 'signal', payload: signal });
  }

  async function sendOneShot(peerId: string, signal: CallSignal) {
    const channel = await openSignalChannel(callChannelName(peerId));
    await channel.send({ type: 'broadcast', event: 'signal', payload: signal });
    void supabase.removeChannel(channel);
  }

  async function endCall(notifyPeer: boolean) {
    const current = callRef.current;
    if (notifyPeer && current) {
      await sendSignal({ type: 'end', callId: current.callId, from: me.id }).catch(() => undefined);
    }
    teardown();
  }

  function createPeer(callId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    const local = localRef.current;
    if (local) local.getTracks().forEach((track) => pc.addTrack(track, local));

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({ type: 'ice', callId, from: me.id, candidate: event.candidate.toJSON() });
    };

    pc.ontrack = (event) => {
      const stream = remoteRef.current ?? new MediaStream();
      if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
      remoteRef.current = stream;
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      const current = callRef.current;
      if (pc.connectionState === 'connected' && current && current.phase !== 'active') {
        patchCall({ phase: 'active', startedAt: Date.now() });
      }
      if (pc.connectionState === 'failed') {
        onNotice('Не удалось соединиться. Возможно, нужен TURN-сервер для связи между сетями.');
        void endCall(true);
      }
    };

    return pc;
  }

  async function flushPendingIce(pc: RTCPeerConnection) {
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of pending) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  async function startCall(peer: { id: string; display_name: string }, kind: CallKind): Promise<string | null> {
    if (callRef.current) return 'Звонок уже идет.';

    const callId = crypto.randomUUID();
    let stream: MediaStream;
    try {
      stream = await acquireMedia(kind);
    } catch {
      return kind === 'video' ? 'Нет доступа к камере или микрофону.' : 'Нет доступа к микрофону.';
    }
    localRef.current = stream;
    setLocalStream(stream);
    callRef.current = {
      callId,
      kind,
      phase: 'outgoing',
      peer: { id: peer.id, name: peer.display_name },
      startedAt: null,
      muted: false,
      cameraOff: false,
    };
    setCall(callRef.current);

    try {
      signalChannelRef.current = await openSignalChannel(callChannelName(peer.id));
    } catch {
      teardown();
      return 'Не удалось начать звонок.';
    }

    await sendSignal({ type: 'invite', callId, from: me.id, fromName: me.display_name, kind });
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onNotice('Собеседник не ответил.');
      void endCall(true);
    }, CALL_RING_TIMEOUT_MS);
    return null;
  }

  function receiveInvite(signal: InviteSignal) {
    if (callRef.current) {
      void sendOneShot(signal.from, { type: 'reject', callId: signal.callId, from: me.id }).catch(() => undefined);
      return;
    }
    callRef.current = {
      callId: signal.callId,
      kind: signal.kind,
      phase: 'incoming',
      peer: { id: signal.from, name: signal.fromName },
      startedAt: null,
      muted: false,
      cameraOff: false,
    };
    setCall(callRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void declineCall();
    }, CALL_RING_TIMEOUT_MS);
  }

  async function declineCall() {
    const current = callRef.current;
    if (!current) return;
    await sendOneShot(current.peer.id, { type: 'reject', callId: current.callId, from: me.id }).catch(() => undefined);
    teardown();
  }

  async function acceptCall() {
    const current = callRef.current;
    if (!current || current.phase !== 'incoming') return;

    let stream: MediaStream;
    try {
      stream = await acquireMedia(current.kind);
    } catch {
      onNotice('Нет доступа к микрофону или камере.');
      await declineCall();
      return;
    }
    if (callRef.current?.callId !== current.callId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    localRef.current = stream;
    setLocalStream(stream);
    clearTimer();

    try {
      signalChannelRef.current = await openSignalChannel(callChannelName(current.peer.id));
    } catch {
      onNotice('Не удалось принять звонок.');
      teardown();
      return;
    }

    patchCall({ phase: 'connecting' });
    createPeer(current.callId);
    await sendSignal({ type: 'accept', callId: current.callId, from: me.id });
  }

  async function handleAccepted(current: ActiveCall) {
    clearTimer();
    patchCall({ phase: 'connecting' });
    const pc = createPeer(current.callId);
    const offer = await pc.createOffer();
    if (!offer.sdp) return;
    await pc.setLocalDescription(offer);
    await sendSignal({ type: 'offer', callId: current.callId, from: me.id, sdp: offer.sdp });
  }

  async function handleOffer(signal: Extract<CallSignal, { type: 'offer' }>) {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
    remoteSetRef.current = true;
    await flushPendingIce(pc);
    const answer = await pc.createAnswer();
    if (!answer.sdp) return;
    await pc.setLocalDescription(answer);
    await sendSignal({ type: 'answer', callId: signal.callId, from: me.id, sdp: answer.sdp });
  }

  async function handleAnswer(signal: Extract<CallSignal, { type: 'answer' }>) {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
    remoteSetRef.current = true;
    await flushPendingIce(pc);
  }

  async function handleIce(signal: Extract<CallSignal, { type: 'ice' }>) {
    const pc = pcRef.current;
    if (!pc) return;
    if (remoteSetRef.current) {
      await pc.addIceCandidate(signal.candidate).catch(() => undefined);
    } else {
      pendingIceRef.current.push(signal.candidate);
    }
  }

  function handleSignal(signal: CallSignal) {
    if (signal.type === 'invite') {
      receiveInvite(signal);
      return;
    }

    const current = callRef.current;
    if (!current || signal.callId !== current.callId || signal.from !== current.peer.id) return;

    switch (signal.type) {
      case 'accept':
        if (current.phase === 'outgoing') void handleAccepted(current);
        return;
      case 'reject':
        onNotice('Собеседник отклонил звонок.');
        teardown();
        return;
      case 'end':
        onNotice('Звонок завершен.');
        teardown();
        return;
      case 'offer':
        void handleOffer(signal);
        return;
      case 'answer':
        void handleAnswer(signal);
        return;
      case 'ice':
        void handleIce(signal);
        return;
    }
  }

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let disposed = false;
    openSignalChannel(callChannelName(me.id), handleSignal)
      .then((opened) => {
        if (disposed) void supabase.removeChannel(opened);
        else channel = opened;
      })
      .catch(() => onNotice('Не удалось подключиться к звонкам.'));
    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [me.id]);

  useEffect(() => teardown, []);

  function toggleMute() {
    const current = callRef.current;
    if (!current) return;
    const muted = !current.muted;
    localRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    patchCall({ muted });
  }

  function toggleCamera() {
    const current = callRef.current;
    if (!current) return;
    const cameraOff = !current.cameraOff;
    localRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    patchCall({ cameraOff });
  }

  return {
    call,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    declineCall,
    hangUp: () => void endCall(true),
    toggleMute,
    toggleCamera,
  };
}
