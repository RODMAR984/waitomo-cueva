// Desplegable de idioma anclado al trigger (popover discreto), no modal centrado.

import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { code: 'es', label: 'Español', testID: 'locale-opt-es' },
  { code: 'en', label: 'English', testID: 'locale-opt-en' },
  { code: 'pt', label: 'Português', testID: 'locale-opt-pt' },
];

const GAP = 6;
const EDGE = 8;

export default function WelcomeLocaleDropdown({ locale, setLocale, layoutStyles, fitT }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const current = OPTIONS.find((o) => o.code === locale) || OPTIONS[0];

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    const node = triggerRef.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      setAnchor({ x: EDGE, y: 80, w: 88, h: 40 });
      setOpen(true);
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setOpen(true);
    });
  }, []);

  const pick = (code) => {
    setLocale(code);
    close();
  };

  const winW = Dimensions.get('window').width;
  let popoverLeft = EDGE;
  let popoverTop = 80;
  let popoverW = 132;
  if (anchor) {
    popoverW = Math.max(Math.ceil(anchor.w), 112);
    popoverLeft = Math.min(Math.max(EDGE, anchor.x), winW - popoverW - EDGE);
    popoverTop = anchor.y + anchor.h + GAP;
  }

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          style={layoutStyles.localeDropdownTrigger}
          onPress={openMenu}
          activeOpacity={0.85}
          testID="locale-dropdown-trigger"
          accessibilityRole="button"
          accessibilityLabel="Idioma"
        >
          <Text style={layoutStyles.localeDropdownTriggerText}>{current.code.toUpperCase()}</Text>
          <Ionicons name="chevron-down" size={18} color={fitT.subText} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={layoutStyles.localePopoverBackdrop} onPress={close}>
          {anchor ? (
            <Pressable
              style={[
                layoutStyles.localePopoverMenu,
                {
                  position: 'absolute',
                  top: popoverTop,
                  left: popoverLeft,
                  width: popoverW,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {OPTIONS.map((o, i) => {
                const active = locale === o.code;
                return (
                  <TouchableOpacity
                    key={o.code}
                    style={[
                      layoutStyles.localePopoverOption,
                      i === OPTIONS.length - 1 && layoutStyles.localePopoverOptionLast,
                      active && layoutStyles.localePopoverOptionActive,
                    ]}
                    onPress={() => pick(o.code)}
                    activeOpacity={0.85}
                    testID={o.testID}
                  >
                    <Text
                      style={[
                        layoutStyles.localePopoverOptionText,
                        active && layoutStyles.localePopoverOptionTextActive,
                      ]}
                    >
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
