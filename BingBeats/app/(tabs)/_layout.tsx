import { Stack } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" }
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="explore" />
    </Stack>
  );
}
