"use client";

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function ManagerApprovalModal({ open, onClose, onApprove, initialCooldown = 0 }) {
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [qrText, setQrText] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [approverEmail, setApproverEmail] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanReqRef = useRef(null);

  useEffect(() => {
    // clear approver email / state when modal closes
    if (!open) {
      setManagerEmail('');
      setManagerPassword('');
      setQrText('');
      setLoading(false);
      setCameraActive(false);
      setApproverEmail(null);
      if (scanReqRef.current) cancelAnimationFrame(scanReqRef.current);
      try { if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }} catch(e){}
    }
  }, [open]);

  useEffect(() => {
    if (lockedUntil && Date.now() > lockedUntil) {
      setLockedUntil(null);
      setFailedAttempts(0);
    }
  }, [lockedUntil]);

  const lockFor = (ms) => {
    setLockedUntil(Date.now() + ms);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      scanLoop();
    } catch (e) {
      console.warn('Camera not available', e);
    }
  };

  const stopCamera = () => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    } catch (e) {}
    setCameraActive(false);
    if (scanReqRef.current) cancelAnimationFrame(scanReqRef.current);
  };

  const scanLoop = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.readyState === 4) {
      // draw frame to canvas
      try {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // dynamic import of jsQR
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          const jsqr = (await import('jsqr')).default || (await import('jsqr'));
          const code = jsqr(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            setQrText(code.data);
            // stop after successful scan
            stopCamera();
          }
        } catch (e) {
          // jsqr not available or failed – silently ignore
        }
      } catch (e) {}
    }
    scanReqRef.current = requestAnimationFrame(scanLoop);
  };

  const [showExample, setShowExample] = useState(true);

  if (!open) return null;

  const canAttempt = !lockedUntil || Date.now() > lockedUntil;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAttempt) return;
    setLoading(true);
    try {
      // prefer QR if provided
      let payload = {};
      if (qrText && qrText.trim()) {
        payload = { qrCode: qrText.trim() };
      } else if (managerPassword && (managerEmail && managerEmail.trim())) {
        payload = { managerEmail: managerEmail.trim(), managerPassword: managerPassword };
      } else {
        payload = {};
      }

      // Expect the parent onApprove to return { success: boolean, approverEmail?: string, message?: string }
      const result = await onApprove(payload);
      if (result && result.success) {
        setApproverEmail(result.approverEmail || null);
        // optionally keep the modal open briefly to show approver info, then close
        setTimeout(() => {
          setApproverEmail(null);
          onClose();
        }, 1400);
        return;
      }

      // failure
      setFailedAttempts((n) => n + 1);
      // lock after 3 failed attempts for 30s (simple policy)
      if (failedAttempts + 1 >= 3) lockFor(30 * 1000);
      // bubble failure message
      return result || { success: false, message: 'Approval failed' };
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-3">Manager/Admin Approval Required</h3>
        <p className="text-sm text-gray-600 mb-4">Enter manager email + password, or paste manager QR/JWT below to approve this action.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Manager Email</label>
            <input value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2 text-black" placeholder="manager@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Manager Password</label>
            <input type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2 text-black" placeholder="Password" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Or paste Manager QR / Token</label>
            <textarea value={qrText} onChange={(e) => setQrText(e.target.value)} rows={3} className="mt-1 block w-full border rounded px-3 py-2 text-black" placeholder="Paste JWT or QR payload here" />
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => (cameraActive ? stopCamera() : startCamera())} className="px-3 py-1 bg-blue-600 text-white rounded">
                {cameraActive ? 'Stop Camera' : 'Scan QR with camera'}
              </button>
              <small className="text-xs text-gray-500">or paste the token manually</small>
            </div>

            {/* Camera preview with overlay guide when active */}
            <div className="mt-2 relative w-full max-h-48">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => { /* trigger */ }}
                className={`w-full max-h-48 object-cover rounded ${cameraActive ? 'block' : 'hidden'}`}
              />

              {cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Rotated dashed guide box - indicates how to angle/position the QR */}
                  <div className="w-11/12 h-40 flex items-center justify-center">
                    <div className="w-full h-full border-2 border-dashed border-white/80 rounded-lg flex items-center justify-center bg-white/10">
                      <div className="flex flex-col items-center justify-center gap-2">
                        {/* Example QR image (place your example at public/example-staff-qr.png) */}
                        {showExample ? (
                          <img
                            src="/example-staff-qr.png"
                            alt="example-qr"
                            className="w-20 h-20 object-contain opacity-40"
                            onError={() => setShowExample(false)}
                          />
                        ) : (
                          // fallback generated QR so users still have a visual
                          <div className="opacity-40">
                            <QRCodeSVG value="example" size={80} level="L" includeMargin={false} />
                          </div>
                        )}
                        <div className="text-sm text-white/90">Place QR inside the frame</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
          {lockedUntil && Date.now() < lockedUntil && (
            <div className="text-sm text-red-600">Too many failed attempts. Try again in {Math.ceil((lockedUntil - Date.now())/1000)}s</div>
          )}

          {approverEmail && (
            <div className="py-2 px-3 bg-blue-50 border border-blue-100 rounded">
              <p className="text-sm text-blue-800">Approved by <strong>{approverEmail}</strong></p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { stopCamera(); onClose(); }} className="px-4 py-2 bg-red-600 text-white rounded">Cancel</button>
            <button type="submit" disabled={loading || !canAttempt} className="px-4 py-2 bg-blue-600 text-white rounded">{loading ? 'Approving...' : 'Approve'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
