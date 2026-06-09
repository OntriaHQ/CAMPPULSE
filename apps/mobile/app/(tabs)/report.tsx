import { StyleSheet, Text, View } from "react-native";
import { INCIDENT_TYPES } from "@camppulse/constants";

export default function ReportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report</Text>
      <Text>Incident reporting shell.</Text>
      <Text style={styles.meta}>Types: {INCIDENT_TYPES.slice(0, 4).join(", ")}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  meta: {
    marginTop: 12,
    color: "#64748b",
  },
});
