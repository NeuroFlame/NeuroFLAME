import { useEffect, useRef } from 'react';
import { Niivue } from '@niivue/niivue';

interface NiiVueViewerProps {
  fileUrl: string;
}

export default function NiiVueViewer({ fileUrl }: NiiVueViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nvRef = useRef<Niivue | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !fileUrl) return;

    const nv = new Niivue({ show3Dcrosshair: true });
    nvRef.current = nv;
    nv.attachToCanvas(canvasRef.current);

    fetch(fileUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        return res.blob();
      })
      .then(async (blob) => {
        const file = new File([blob], 'volume.nii.gz');

        await nv.loadFromFile(file); // ✅ no need to call addVolume()
      })
      .catch((err) => {
        console.error('❌ NiiVue load error:', err);
      });

    return () => {
      nvRef.current = null;
    };
  }, [fileUrl]);

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 170px)', background: 'black' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
