import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEventImpl = null;
try {
  const m = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = m.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEventImpl = m.useSpeechRecognitionEvent;
} catch (_) {
  /* dev client sin rebuild tras agregar expo-speech-recognition */
}

/** Misma firma que el hook real, para no violar reglas de hooks si el nativo no existe. */
function useSpeechRecognitionEventNoop(_eventName, _listener) {}

const useSpeechREvent = useSpeechRecognitionEventImpl || useSpeechRecognitionEventNoop;

const FITNESS_CONTEXT = [
  'snatch',
  'snatches',
  'clean',
  'jerk',
  'thruster',
  'thrusters',
  'squat',
  'deadlift',
  'pull-up',
  'pull ups',
  'RM',
  '1RM',
  '2RM',
  '3RM',
  '%RM',
  'Hyrox',
  'cross',
  'series',
  'reps',
  'set',
  'sets',
  'por ciento',
];

export function recognitionLocaleFromAppLocale(locale) {
  if (String(locale || '').toLowerCase().startsWith('en')) return 'en-US';
  return 'es-AR';
}

export const isAiVoiceNativeAvailable = () =>
  !!ExpoSpeechRecognitionModule && !!useSpeechRecognitionEventImpl;

/**
 * Dictado → texto en el prompt de IA. Si falta el módulo nativo (sin `expo run:android/ios`),
 * `voiceNativeAvailable` es false y no se debe mostrar el mic.
 */
export function useAiVoiceDictation({ tStr, locale, modalVisible, getPrompt, setPrompt }) {
  const listeningRef = useRef(false);
  const [listening, setListening] = useState(false);
  const prefixRef = useRef('');
  const setPromptRef = useRef(setPrompt);
  setPromptRef.current = setPrompt;
  const getPromptRef = useRef(getPrompt);
  getPromptRef.current = getPrompt;

  useSpeechREvent('result', (ev) => {
    if (!ExpoSpeechRecognitionModule || !listeningRef.current) return;
    const piece = String(ev.results?.[0]?.transcript ?? '').trimEnd();
    const pre = prefixRef.current;
    const next =
      !pre && !piece ? '' : !pre ? piece : `${pre.trimEnd()}${piece ? ` ${piece}` : ''}`.trimEnd();
    setPromptRef.current(next);
  });

  useSpeechREvent('end', () => {
    if (!ExpoSpeechRecognitionModule) return;
    listeningRef.current = false;
    setListening(false);
  });

  useSpeechREvent('error', (ev) => {
    if (!ExpoSpeechRecognitionModule) return;
    listeningRef.current = false;
    setListening(false);
    if (ev.error === 'aborted') return;
    const detail = ev.message || ev.error || '';
    Alert.alert(
      tStr('gym_config_alert_title_error'),
      tStr('admin_ai_voice_error').replace('{{detail}}', String(detail)),
    );
  });

  useEffect(() => {
    if (!modalVisible) {
      if (ExpoSpeechRecognitionModule?.abort) {
        ExpoSpeechRecognitionModule.abort().catch(() => {});
      }
      listeningRef.current = false;
      setListening(false);
    }
  }, [modalVisible]);

  const toggleListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(tStr('admin_ai_voice_need_title'), tStr('admin_ai_voice_need_rebuild'));
      return;
    }
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_ai_voice_native_only'));
      return;
    }
    if (listeningRef.current) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {}
      return;
    }
    let perm;
    try {
      perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    } catch (e) {
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        tStr('admin_ai_voice_error').replace('{{detail}}', String(e?.message || e)),
      );
      return;
    }
    if (!perm.granted) {
      Alert.alert(tStr('admin_ai_title'), tStr('admin_ai_voice_permission'));
      return;
    }
    prefixRef.current = String(getPromptRef.current() || '').trimEnd();
    listeningRef.current = true;
    setListening(true);
    try {
      ExpoSpeechRecognitionModule.start({
        lang: recognitionLocaleFromAppLocale(locale),
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        contextualStrings: FITNESS_CONTEXT,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2200,
        },
      });
    } catch (e) {
      listeningRef.current = false;
      setListening(false);
      Alert.alert(
        tStr('gym_config_alert_title_error'),
        tStr('admin_ai_voice_error').replace('{{detail}}', String(e?.message || e)),
      );
    }
  }, [locale, tStr]);

  return {
    listening,
    toggleListening,
    voiceNativeAvailable: isAiVoiceNativeAvailable(),
  };
}
