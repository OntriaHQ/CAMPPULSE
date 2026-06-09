import { StyleSheet, Text, View } from "react-native";
import { ROLES } from "@camppulse/constants";

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Map</Text>
      <Text>Main navigation map shell.</Text>
      <Text style={styles.meta}>Roles: {ROLES.join(", ")}</Text>
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
