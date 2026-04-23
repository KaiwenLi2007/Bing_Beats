import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCyclingTheme } from "../contexts/CyclingGradientContext";
import { useDiscovery } from "../contexts/DiscoveryContext";
import { sendChatMessage } from "../lib/api";
import { colors, radii, spacing, typography } from "../lib/theme";
import type { ChatContext, ChatMessage, ChatPlaylistSnapshot } from "../lib/types";

const CURRENT_YEAR = new Date().getFullYear();

function buildChatContext(
  countryName: string,
  countryCode: string,
  year: number | null
): ChatContext {
  return {
    country: countryName,
    country_code: countryCode,
    year: year ?? CURRENT_YEAR,
    current_tracks: []
  };
}

const PLAYLIST_PREVIEW_MAX = 5;

function ChatPlaylistCard({
  playlist,
  onOpenFull
}: {
  playlist: ChatPlaylistSnapshot;
  onOpenFull: () => void;
}) {
  const preview = playlist.tracks.slice(0, PLAYLIST_PREVIEW_MAX);
  return (
    <View style={styles.playlistCard}>
      <Text style={styles.playlistCardTitle}>
        {playlist.country_name} · {playlist.year}
      </Text>
      {preview.map((t) => (
        <View key={t.id} style={styles.playlistRow}>
          {t.album_art ? (
            <Image source={{ uri: t.album_art }} style={styles.playlistArt} />
          ) : (
            <View style={[styles.playlistArt, styles.playlistArtPlaceholder]}>
              <Ionicons color={colors.text.tertiary} name="musical-note" size={16} />
            </View>
          )}
          <View style={styles.playlistRowText}>
            <Text numberOfLines={1} style={styles.playlistTrackTitle}>
              {t.name}
            </Text>
            <Text numberOfLines={1} style={styles.playlistTrackArtist}>
              {t.artist}
            </Text>
          </View>
        </View>
      ))}
      {playlist.tracks.length > PLAYLIST_PREVIEW_MAX ? (
        <Text style={styles.playlistMore}>
          +{playlist.tracks.length - PLAYLIST_PREVIEW_MAX} more
        </Text>
      ) : null}
      <Pressable
        accessibilityLabel="Open full playlist for this place and year"
        accessibilityRole="button"
        onPress={onOpenFull}
        style={({ pressed }) => [styles.playlistOpenBtn, pressed && styles.playlistOpenBtnPressed]}
      >
        <Text style={styles.playlistOpenBtnText}>Open full playlist</Text>
        <Ionicons color={colors.text.primary} name="chevron-forward" size={18} />
      </Pressable>
    </View>
  );
}

export function ChatAssistant() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cycling = useCyclingTheme();
  const { height: windowHeight } = useWindowDimensions();
  const { country, year } = useDiscovery();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const contextLabel =
    country && year
      ? `${country.flag} ${country.name} · ${year}`
      : country
        ? `${country.flag} ${country.name} · year not set`
        : "Pick a country and year on Home for richer answers";

  /** Fixed height so flex layout (FlatList) works; ~78% of screen, capped below status area. */
  const sheetHeight = Math.min(
    Math.round(windowHeight * 0.78),
    580,
    windowHeight - insets.top - 32
  );

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  useEffect(() => {
    if (open) {
      scrollToEnd();
    }
  }, [open, messages.length, scrollToEnd]);

  function close() {
    Keyboard.dismiss();
    setOpen(false);
  }

  async function handleSend(overrideText?: string) {
    const raw = (overrideText ?? input).trim();
    const text =
      raw.toLowerCase() === "/playlist"
        ? "Give me a playlist of songs for this place and year."
        : raw;
    if (!text || sending) {
      return;
    }
    setInput("");
    const prior = messages;
    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setSending(true);
    scrollToEnd();

    try {
      const ctx = buildChatContext(
        country?.name ?? "Not selected",
        country?.code ?? "",
        year
      );
      const { response, playlist } = await sendChatMessage(text, ctx, prior);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: response,
          ...(playlist && playlist.tracks.length > 0 ? { playlist } : {})
        }
      ]);
    } catch (err) {
      const textErr =
        err instanceof Error
          ? err.message
          : "Could not reach the assistant. Check your connection and API server.";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${textErr}` }
      ]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }

  const fabTop = insets.top + spacing.sm;

  return (
    <>
      <Pressable
        accessibilityLabel="Open music assistant chat"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: cycling.accent,
            top: fabTop,
            opacity: pressed ? 0.92 : 1,
            shadowColor: cycling.accent
          }
        ]}
      >
        <Ionicons color={colors.text.primary} name="chatbubbles" size={26} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={close}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View style={styles.modalFullScreen} pointerEvents="box-none">
          <Pressable
            accessibilityLabel="Dismiss chat"
            accessibilityRole="button"
            onPress={close}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.backdropDim} />
          </Pressable>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            pointerEvents="box-none"
            style={styles.keyboardOuter}
          >
            <View
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  marginBottom: Math.max(insets.bottom, spacing.sm)
                }
              ]}
            >
              <LinearGradient
                colors={[cycling.gradientTop, cycling.gradientBottom]}
                end={{ x: 0.5, y: 1 }}
                start={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.sheetInner}>
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetTitleBlock}>
                    <Text style={styles.sheetTitle}>BingBeats Guide</Text>
                    <Text numberOfLines={2} style={styles.sheetContext}>
                      {contextLabel}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close chat"
                    hitSlop={12}
                    onPress={close}
                    style={styles.closeHit}
                  >
                    <Ionicons color={colors.text.secondary} name="close" size={26} />
                  </Pressable>
                </View>

                {messages.length === 0 ? (
                  <View style={styles.suggestions}>
                    <Text style={styles.suggestionsLabel}>Try asking</Text>
                    <Pressable
                      onPress={() => void handleSend("What music genre fits this country in this year?")}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
                    >
                      <Text style={styles.suggestionChipText}>
                        What genre fits this place and year?
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        void handleSend(
                          "Name one or two representative genres for popular music here in this year, briefly."
                        )
                      }
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
                    >
                      <Text style={styles.suggestionChipText}>Suggest genres for this era</Text>
                    </Pressable>
                    {country && year ? (
                      <Pressable
                        onPress={() =>
                          void handleSend("Give me a playlist of songs for this place and year.")
                        }
                        style={({ pressed }) => [styles.suggestionChip, pressed && styles.suggestionChipPressed]}
                      >
                        <Text style={styles.suggestionChipText}>Make me a playlist for this year</Text>
                      </Pressable>
                    ) : null}
                    <Text style={styles.suggestionsHint}>Shortcut: type /playlist</Text>
                  </View>
                ) : null}

                <FlatList
                  ref={listRef}
                  contentContainerStyle={styles.messageListContent}
                  data={messages}
                  keyExtractor={(_, i) => `m-${i}`}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.bubble,
                        item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                      ]}
                    >
                      <Text
                        style={
                          item.role === "user" ? styles.bubbleTextUser : styles.bubbleTextAssistant
                        }
                      >
                        {item.content}
                      </Text>
                      {item.role === "assistant" &&
                      item.playlist &&
                      item.playlist.tracks.length > 0 ? (
                        <ChatPlaylistCard
                          playlist={item.playlist}
                          onOpenFull={() => {
                            setOpen(false);
                            router.push({
                              pathname: "/playlist",
                              params: {
                                code: item.playlist!.country_code,
                                name: item.playlist!.country_name,
                                year: String(item.playlist!.year)
                              }
                            });
                          }}
                        />
                      ) : null}
                    </View>
                  )}
                  showsVerticalScrollIndicator={true}
                  style={styles.messageList}
                />

                {sending ? (
                  <View style={styles.typingRow}>
                    <ActivityIndicator color={cycling.accent} size="small" />
                    <Text style={styles.typingText}>Thinking…</Text>
                  </View>
                ) : null}

                <View style={styles.composerRow}>
                  <TextInput
                    editable={!sending}
                    multiline
                    onChangeText={setInput}
                    onSubmitEditing={() => void handleSend()}
                    placeholder="Ask about genres, scenes, or type /playlist…"
                    placeholderTextColor={colors.text.tertiary}
                    returnKeyType="send"
                    style={styles.input}
                    value={input}
                  />
                  <Pressable
                    accessibilityLabel="Send message"
                    disabled={sending || !input.trim()}
                    onPress={() => void handleSend()}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      { backgroundColor: cycling.accent },
                      (sending || !input.trim()) && styles.sendBtnDisabled,
                      pressed && !sending && input.trim() && styles.sendBtnPressed
                    ]}
                  >
                    <Ionicons color={colors.text.primary} name="arrow-up" size={22} />
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: "center",
    borderRadius: radii.full,
    elevation: 8,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    right: spacing.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    width: 56,
    zIndex: 50
  },
  /** Full window so the sheet can sit above the dim layer reliably (iOS + Android). */
  modalFullScreen: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  keyboardOuter: {
    flex: 1,
    justifyContent: "flex-end",
    maxHeight: "100%",
    width: "100%"
  },
  sheet: {
    alignSelf: "stretch",
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    marginHorizontal: 0,
    overflow: "hidden",
    width: "100%"
  },
  sheetInner: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  sheetTitleBlock: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0
  },
  sheetTitle: {
    ...typography.heading,
    fontSize: 18
  },
  sheetContext: {
    ...typography.caption,
    marginTop: 4
  },
  closeHit: {
    padding: spacing.xs
  },
  suggestions: {
    marginBottom: spacing.sm
  },
  suggestionsLabel: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginBottom: spacing.sm
  },
  suggestionsHint: {
    ...typography.micro,
    color: colors.text.tertiary,
    marginTop: 2
  },
  suggestionChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  suggestionChipPressed: {
    opacity: 0.88
  },
  suggestionChipText: {
    ...typography.subtitle,
    fontSize: 14
  },
  messageList: {
    flex: 1,
    minHeight: 80
  },
  messageListContent: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.sm
  },
  bubble: {
    borderRadius: radii.md,
    maxWidth: "92%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.bg.elevated
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: colors.border.subtle,
    borderWidth: 1
  },
  bubbleTextUser: {
    ...typography.body,
    fontSize: 15
  },
  bubbleTextAssistant: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22
  },
  typingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  typingText: {
    ...typography.caption
  },
  composerRow: {
    alignItems: "flex-end",
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.xs,
    paddingTop: spacing.sm
  },
  input: {
    ...typography.body,
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm
  },
  sendBtn: {
    alignItems: "center",
    borderRadius: radii.full,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sendBtnDisabled: {
    opacity: 0.45
  },
  sendBtnPressed: {
    opacity: 0.9
  },
  playlistCard: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.sm,
    paddingTop: spacing.sm
  },
  playlistCardTitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: spacing.sm
  },
  playlistRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs
  },
  playlistArt: {
    borderRadius: radii.sm,
    height: 40,
    width: 40
  },
  playlistArtPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    justifyContent: "center"
  },
  playlistRowText: {
    flex: 1,
    minWidth: 0
  },
  playlistTrackTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19
  },
  playlistTrackArtist: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 2
  },
  playlistMore: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.sm
  },
  playlistOpenBtn: {
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    paddingVertical: spacing.sm
  },
  playlistOpenBtnPressed: {
    opacity: 0.9
  },
  playlistOpenBtnText: {
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18
  }
});
