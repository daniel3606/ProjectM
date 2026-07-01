import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
});
