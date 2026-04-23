import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAiVoiceDictation } from '../hooks/useAiVoiceDictation';

/** Prompt de IA: siempre muestra el mic al lado del campo (si falta el nativo, al tocar explica cómo activarlo). */
export default function AdminAiPromptWithVoice({
  aiPrompt,
  setAiPrompt,
  aiBusy,
  tStr,
  locale,
  modalVisible,
  styles,
  placeholderColor,
  brandColor,
  subTextColor,
}) {
  const { listening: aiVoiceListening, toggleListening: toggleAiVoice, voiceNativeAvailable } =
    useAiVoiceDictation({
      tStr,
      locale,
      modalVisible,
      getPrompt: () => aiPrompt,
      setPrompt: setAiPrompt,
    });

  return (
    <>
      <View style={styles.aiPromptRow}>
        <TextInput
          value={aiPrompt}
          onChangeText={setAiPrompt}
          placeholder={tStr('admin_ai_prompt_ph')}
          placeholderTextColor={placeholderColor}
          style={styles.aiPromptInput}
          multiline
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={tStr('admin_ai_voice_a11y')}
          onPress={toggleAiVoice}
          disabled={aiBusy}
          style={[
            styles.aiVoiceMicBtn,
            aiVoiceListening && styles.aiVoiceMicBtnOn,
            aiBusy && { opacity: 0.45 },
            !voiceNativeAvailable && { opacity: 0.55 },
          ]}
          activeOpacity={0.85}
        >
          <Ionicons
            name={aiVoiceListening ? 'mic' : 'mic-outline'}
            size={24}
            color={aiVoiceListening ? brandColor : subTextColor}
          />
        </TouchableOpacity>
      </View>
      {aiVoiceListening ? (
        <Text style={styles.aiVoiceHint}>{tStr('admin_ai_voice_listening')}</Text>
      ) : !voiceNativeAvailable ? (
        <Text style={styles.aiVoiceHint}>{tStr('admin_ai_voice_mic_unavailable')}</Text>
      ) : null}
    </>
  );
}
