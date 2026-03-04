import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Mic, Volume2, Loader2, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface SpaceAudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export const SpaceAudioSettingsModal = ({
  isOpen,
  onClose,
}: SpaceAudioSettingsModalProps) => {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceOption[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceOption[]>([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const [volume, setVolume] = useState([75]);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
        }));
      
      const outputs = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 5)}`,
        }));

      setAudioInputs(inputs);
      setAudioOutputs(outputs);

      if (inputs.length > 0 && !selectedInput) {
        setSelectedInput(inputs[0].deviceId);
      }
      if (outputs.length > 0 && !selectedOutput) {
        setSelectedOutput(outputs[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      toast.error('Could not access audio devices');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    // Store preferences in localStorage for persistence
    localStorage.setItem('space_audio_settings', JSON.stringify({
      inputDevice: selectedInput,
      outputDevice: selectedOutput,
      volume: volume[0],
      echoCancellation,
      noiseSuppression,
    }));

    toast.success('Audio settings saved');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg bg-zinc-900 rounded-t-3xl max-h-[85vh] overflow-hidden sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:w-full"
          >
            {/* Handle bar */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mt-4 mb-2" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold">Audio Settings</h2>
                  <p className="text-zinc-500 text-sm">Configure your audio devices</p>
                </div>
              </div>
              <button
                onClick={loadDevices}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6 overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Microphone Selection */}
                  <div>
                    <label className="flex items-center gap-2 text-white font-medium mb-3">
                      <Mic className="w-4 h-4 text-zinc-400" />
                      Microphone
                    </label>
                    <select
                      value={selectedInput}
                      onChange={(e) => setSelectedInput(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                    >
                      {audioInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaker Selection */}
                  <div>
                    <label className="flex items-center gap-2 text-white font-medium mb-3">
                      <Volume2 className="w-4 h-4 text-zinc-400" />
                      Speaker
                    </label>
                    <select
                      value={selectedOutput}
                      onChange={(e) => setSelectedOutput(e.target.value)}
                      className="w-full bg-zinc-800 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                    >
                      {audioOutputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Volume Slider */}
                  <div>
                    <label className="flex items-center justify-between text-white font-medium mb-3">
                      <span>Volume</span>
                      <span className="text-zinc-400 text-sm">{volume[0]}%</span>
                    </label>
                    <Slider
                      value={volume}
                      onValueChange={setVolume}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Echo Cancellation Toggle */}
                  <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                    <div>
                      <p className="text-white font-medium">Echo Cancellation</p>
                      <p className="text-zinc-500 text-sm">Reduce echo from speakers</p>
                    </div>
                    <Switch
                      checked={echoCancellation}
                      onCheckedChange={setEchoCancellation}
                    />
                  </div>

                  {/* Noise Suppression Toggle */}
                  <div className="flex items-center justify-between py-3 border-t border-zinc-800">
                    <div>
                      <p className="text-white font-medium">Noise Suppression</p>
                      <p className="text-zinc-500 text-sm">Reduce background noise</p>
                    </div>
                    <Switch
                      checked={noiseSuppression}
                      onCheckedChange={setNoiseSuppression}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Save button */}
            <div className="px-6 pb-6 pb-safe">
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
              >
                Save Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
