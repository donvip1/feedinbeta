import { useState } from 'react';

interface CameraCaptureProps {
  onCapture: (media: { url: string; type: 'image' | 'video' }) => void;
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const [captured, setCaptured] = useState(false);

  const handleCapture = () => {
    // Simulate capture
    const dummyMedia = {
      url: '/placeholder.svg',
      type: 'image' as const,
    };
    setCaptured(true);
    onCapture(dummyMedia);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
      <div className="text-white text-lg mb-4">Camera (Portrait)</div>
      <button
        onClick={handleCapture}
        className="bg-white text-black px-6 py-3 rounded-full font-semibold"
      >
        Capture
      </button>
    </div>
  );
}
