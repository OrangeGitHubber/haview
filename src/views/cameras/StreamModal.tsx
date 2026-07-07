import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { HassEntity } from 'home-assistant-js-websocket';
import type HlsType from 'hls.js';
import { getConnection } from '../../lib/ha/connection';
import { haBase } from '../../lib/config';
import { Spinner } from '../../components/Spinner';
import { useSnapshot } from './useSnapshot';
import styles from './cameras.module.css';

const START_TIMEOUT_MS = 15_000;

/**
 * Live camera view. Tries WebRTC first (this is what HA's own UI uses for
 * UniFi Protect / go2rtc), falling back to HLS. Playback is detected from
 * the <video> element's own events, and a hard timeout guarantees the user
 * always gets feedback instead of an endless spinner.
 */
export function StreamModal({ entity, onClose }: { entity: HassEntity; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pressedBackdrop = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const name = (entity.attributes.friendly_name as string | undefined) ?? entity.entity_id;
  const { src: snapshotSrc } = useSnapshot(
    entity.entity_id,
    0,
    entity.attributes.entity_picture as string | undefined,
  );

  useEffect(() => {
    let cancelled = false;
    let started = false;
    let hls: HlsType | null = null;
    let pc: RTCPeerConnection | null = null;
    let unsub: (() => void) | null = null;
    let webrtcDiag = '';
    const video = videoRef.current;

    const markPlaying = () => {
      if (cancelled) return;
      started = true;
      window.clearTimeout(timeout);
      setStarting(false);
    };

    const timeout = window.setTimeout(() => {
      if (cancelled || started) return;
      setError(
        `Timed out starting the live stream.${webrtcDiag ? ` (${webrtcDiag})` : ''} The stream may not be reachable from this device — snapshots still update below.`,
      );
      setStarting(false);
    }, START_TIMEOUT_MS);

    if (video) {
      video.addEventListener('playing', markPlaying);
      video.addEventListener('loadeddata', markPlaying);
    }

    const features =
      typeof entity.attributes.supported_features === 'number'
        ? entity.attributes.supported_features
        : 0;
    const canStream = (features & 2) !== 0;

    // ---- WebRTC (matches HA's frontend: trickle ICE over camera/webrtc/*) ----
    // Local refs; cleans up on failure, hands off to effect-scope pc/unsub
    // only on success.
    async function tryWebRTC(): Promise<boolean> {
      if (!video || typeof RTCPeerConnection === 'undefined') return false;
      const localPc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      let localUnsub: (() => void) | null = null;
      let sessionId: string | null = null;
      const pending: RTCIceCandidate[] = [];
      const giveUp = (): false => {
        if (localUnsub) localUnsub();
        localPc.close();
        return false;
      };
      try {
        const conn = await getConnection();
        localPc.addTransceiver('video', { direction: 'recvonly' });
        localPc.addTransceiver('audio', { direction: 'recvonly' });
        localPc.addEventListener('track', (ev) => {
          if (cancelled) return;
          if (video.srcObject !== ev.streams[0]) {
            video.srcObject = ev.streams[0];
            video.play().catch(() => {});
          }
        });

        const sendCandidate = (cand: RTCIceCandidate | null) => {
          const sid = sessionId;
          if (!cand || !sid) return;
          conn
            .sendMessagePromise({
              type: 'camera/webrtc/candidate',
              entity_id: entity.entity_id,
              session_id: sid,
              candidate: cand.toJSON(),
            })
            .catch(() => {});
        };
        localPc.addEventListener('icecandidate', (ev) => {
          if (cancelled) return;
          if (!sessionId) {
            if (ev.candidate) pending.push(ev.candidate);
          } else {
            sendCandidate(ev.candidate);
          }
        });

        const offer = await localPc.createOffer();
        await localPc.setLocalDescription(offer);
        const sdp = localPc.localDescription?.sdp;
        if (cancelled || !sdp) return giveUp();

        const ok = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (result: boolean) => {
            if (settled) return;
            settled = true;
            if (result) {
              pc = localPc;
              unsub = localUnsub;
            } else {
              giveUp();
            }
            resolve(result);
          };

          // success/failure is decided by the ICE connection outcome
          localPc.addEventListener('iceconnectionstatechange', () => {
            const st = localPc.iceConnectionState;
            webrtcDiag = `WebRTC ICE ${st}`;
            if (st === 'connected' || st === 'completed') {
              markPlaying();
              finish(true);
            } else if (st === 'failed') {
              finish(false);
            }
          });

          conn
            .subscribeMessage<{
              type: string;
              answer?: string;
              candidate?: string | RTCIceCandidateInit;
              session_id?: string;
              error?: { message?: string };
            }>(
              (msg) => {
                if (cancelled) return;
                if (msg.type === 'session' && msg.session_id) {
                  sessionId = msg.session_id;
                  for (const c of pending) sendCandidate(c);
                  pending.length = 0;
                } else if (msg.type === 'answer' && msg.answer) {
                  webrtcDiag = 'WebRTC answer received';
                  localPc
                    .setRemoteDescription({ type: 'answer', sdp: msg.answer })
                    .catch(() => {});
                } else if (msg.type === 'candidate' && msg.candidate) {
                  const c = msg.candidate;
                  const init: RTCIceCandidateInit =
                    typeof c === 'string' ? { candidate: c, sdpMLineIndex: 0 } : c;
                  localPc.addIceCandidate(init).catch(() => {});
                } else if (msg.type === 'error') {
                  webrtcDiag = `WebRTC rejected: ${msg.error?.message ?? 'error'}`;
                  finish(false);
                }
              },
              { type: 'camera/webrtc/offer', entity_id: entity.entity_id, offer: sdp },
            )
            .then((u) => {
              localUnsub = u;
            })
            .catch(() => {
              webrtcDiag = 'WebRTC not supported by this Home Assistant';
              finish(false);
            });

          // overall cap on the WebRTC attempt → fall back to HLS
          window.setTimeout(() => finish(false), 10_000);
        });

        return ok;
      } catch {
        return giveUp();
      }
    }

    // ---- HLS fallback ----
    async function tryHLS(): Promise<void> {
      if (!video) return;
      try {
        const conn = await getConnection();
        const { url } = await conn.sendMessagePromise<{ url: string }>({
          type: 'camera/stream',
          entity_id: entity.entity_id,
        });
        const streamUrl = haBase() + url; // HLS served through the reverse proxy
        if (cancelled) return;

        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl; // iOS / Safari native HLS
          video.play().catch(() => {});
        } else {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;
          if (!Hls.isSupported()) throw new Error('HLS unsupported in this browser');
          hls = new Hls({ liveSyncDurationCount: 3, enableWorker: true });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          hls.on(Hls.Events.ERROR, (_ev, data) => {
            if (data.fatal && !cancelled && !started) {
              setError(
                `The live stream failed (${data.type}: ${data.details}). WebRTC also did not connect — snapshots still update below.`,
              );
              setStarting(false);
              window.clearTimeout(timeout);
            }
          });
        }
      } catch (err) {
        if (cancelled || started) return;
        const msg =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : '';
        setError(
          `Could not start the live stream${msg ? ` — ${msg}` : ''}. Snapshots still update below.`,
        );
        setStarting(false);
        window.clearTimeout(timeout);
      }
    }

    (async () => {
      if (!canStream) {
        setError(
          'This camera entity does not offer a live stream (in UniFi Protect, enable RTSPS for this channel and reload the integration, or point this card at a streamable channel entity). Snapshots still update below.',
        );
        setStarting(false);
        window.clearTimeout(timeout);
        return;
      }
      const rtcOk = await tryWebRTC();
      if (cancelled || started) return;
      // tryWebRTC cleaned up after itself on failure; just fall back
      if (!rtcOk) await tryHLS();
    })();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKey);
      if (unsub) unsub();
      if (pc) pc.close();
      if (hls) hls.destroy();
      if (video) {
        video.removeEventListener('playing', markPlaying);
        video.removeEventListener('loadeddata', markPlaying);
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [entity.entity_id, onClose]);

  // portal: must paint above grid items regardless of where it's rendered
  return createPortal(
    <div
      class={styles.modal}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div class={styles.modalInner} onClick={(e) => e.stopPropagation()}>
        <header class={styles.modalHeader}>
          <span>{name}</span>
          <button class={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div class={styles.videoWrap}>
          <video ref={videoRef} playsInline muted autoPlay controls={false} />
          {/* show the live snapshot immediately while the stream connects, so
              the camera image appears in ~1s instead of black + spinner */}
          {starting && !error && snapshotSrc && (
            <img class={styles.fallbackSnap} src={snapshotSrc} alt={name} />
          )}
          {starting && !error && (
            <div class={styles.videoOverlay}>
              <Spinner />
              <span class={styles.connectingNote}>Connecting live view…</span>
            </div>
          )}
          {error && snapshotSrc && (
            <>
              <img class={styles.fallbackSnap} src={snapshotSrc} alt={name} />
              <div class={styles.fallbackNote}>{error}</div>
            </>
          )}
          {error && !snapshotSrc && <div class={styles.videoOverlay}>{error}</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
