import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

interface Modification {
  id: string; name: string; category: string; vendor?: string; brand?: string;
  price?: number | null; actualPrice?: number | null; notes?: string;
  status: string; priority: string; installDate?: string; difficulty?: string;
  partNumber?: string;
}
interface MaintenanceLog {
  id: string; service: string; date: string; mileage?: number | null;
  cost?: number | null; notes?: string; shop?: string; diy: boolean;
}
interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string;
  trim?: string; platform?: string; engine?: string; transmission?: string;
  drivetrain?: string; mileage?: number; color?: string; notes?: string;
  modifications: Modification[];
  maintenanceLogs: MaintenanceLog[];
}

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned", RESEARCHING: "Researching", ORDERED: "Ordered",
  PURCHASED: "Purchased", INSTALLED: "Installed", REMOVED: "Removed",
};
const STATUS_COLOR: Record<string, string> = {
  PLANNED: "#64748b", RESEARCHING: "#3b82f6", ORDERED: "#eab308",
  PURCHASED: "#a855f7", INSTALLED: "#22c55e", REMOVED: "#ef4444",
};

function fmt(n?: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(s?: string | null) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

const mk = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 8.5, color: "#1a1a1a", backgroundColor: "#ffffff", paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40 },

  // Header
  headerBar: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  headerLeft: { flex: 1 },
  vehicleName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#0f0f0f", lineHeight: 1.1 },
  vehicleSub: { fontSize: 10, color: "#555", marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  buildLabel: { fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
  buildValue: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 1 },
  divider: { height: 2, borderRadius: 1, marginBottom: 16 },

  // Stats row
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 4, padding: 8 },
  statLabel: { fontSize: 6.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  statValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#111" },

  // Vehicle specs
  specsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 0, backgroundColor: "#f9f9f9", borderRadius: 4, padding: 10, marginBottom: 20 },
  specItem: { width: "25%", paddingVertical: 3, paddingHorizontal: 4 },
  specLabel: { fontSize: 6.5, color: "#888", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 1.5 },
  specValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },

  // Section header
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6, marginTop: 14 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },
  sectionCount: { marginLeft: 6, fontSize: 7.5, color: "#888" },
  sectionTotal: { marginLeft: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  sectionLine: { flex: 1, height: 0.5, backgroundColor: "#e0e0e0", marginLeft: 8 },

  // Mod table
  modRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#efefef", paddingVertical: 4.5, paddingHorizontal: 4, alignItems: "center" },
  modRowAlt: { backgroundColor: "#fafafa" },
  modName: { flex: 3, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#111" },
  modMeta: { flex: 2, fontSize: 7.5, color: "#666" },
  modStatus: { width: 60, fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, textAlign: "center", color: "#fff" },
  modPrice: { width: 54, fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#111" },

  // Maintenance table
  maintRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#efefef", paddingVertical: 4, paddingHorizontal: 4, alignItems: "center" },
  maintService: { flex: 3, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#111" },
  maintDate: { flex: 2, fontSize: 7.5, color: "#666" },
  maintCost: { width: 54, fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right", color: "#111" },

  // Notes
  notesBox: { backgroundColor: "#f9f9f9", borderRadius: 4, padding: 10, marginTop: 14 },
  notesText: { fontSize: 8, color: "#444", lineHeight: 1.6 },

  // Footer
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7, color: "#aaa" },
});

export function BuildSheetDocument({ vehicle, accentColor = "#e84d3d" }: { vehicle: Vehicle; accentColor?: string }) {
  const mods = vehicle.modifications;
  const installedValue = mods.filter(m => m.status === "INSTALLED").reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const totalValue = mods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const plannedValue = mods.filter(m => m.status !== "INSTALLED").reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const installCount = mods.filter(m => m.status === "INSTALLED").length;
  const completion = mods.length > 0 ? Math.round((installCount / mods.length) * 100) : 0;

  const modsByCategory = mods.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const vehicleTitle = vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const vehicleSub = vehicle.name ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}` : vehicle.trim || "";

  const specs: Array<{ label: string; value: string }> = [
    vehicle.engine      ? { label: "Engine",       value: vehicle.engine }       : null,
    vehicle.transmission? { label: "Transmission", value: vehicle.transmission } : null,
    vehicle.drivetrain  ? { label: "Drivetrain",   value: vehicle.drivetrain }   : null,
    vehicle.platform    ? { label: "Platform",     value: vehicle.platform }     : null,
    vehicle.color       ? { label: "Color",        value: vehicle.color }        : null,
    vehicle.mileage != null ? { label: "Mileage", value: vehicle.mileage.toLocaleString() + " mi" } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <Document title={`${vehicleTitle} — Build Sheet`} author="BuildVerse">
      <Page size="A4" style={mk.page}>

        {/* Header */}
        <View style={mk.headerBar}>
          <View style={mk.headerLeft}>
            <Text style={mk.vehicleName}>{vehicleTitle}</Text>
            {vehicleSub ? <Text style={mk.vehicleSub}>{vehicleSub}</Text> : null}
          </View>
          <View style={mk.headerRight}>
            <Text style={mk.buildLabel}>Build Complete</Text>
            <Text style={[mk.buildValue, { color: accentColor }]}>{completion}%</Text>
          </View>
        </View>
        <View style={[mk.divider, { backgroundColor: accentColor }]} />

        {/* Stats */}
        <View style={mk.statsRow}>
          {[
            { label: "Installed Value",  value: fmt(installedValue),  color: "#22c55e" },
            { label: "Planned Spend",    value: fmt(plannedValue),    color: accentColor },
            { label: "Total Build",      value: fmt(totalValue),      color: "#1a1a1a" },
            { label: "Total Mods",       value: String(mods.length),  color: "#1a1a1a" },
          ].map(({ label, value, color }) => (
            <View key={label} style={mk.statBox}>
              <Text style={mk.statLabel}>{label}</Text>
              <Text style={[mk.statValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Specs */}
        {specs.length > 0 && (
          <View style={mk.specsGrid}>
            {specs.map(({ label, value }) => (
              <View key={label} style={mk.specItem}>
                <Text style={mk.specLabel}>{label}</Text>
                <Text style={mk.specValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Modifications */}
        {Object.entries(modsByCategory).map(([cat, catMods]) => {
          const catTotal = catMods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
          return (
            <View key={cat} wrap={false}>
              <View style={mk.sectionHeader}>
                <Text style={[mk.sectionTitle, { color: "#444" }]}>{cat}</Text>
                <Text style={mk.sectionCount}>{catMods.length} mod{catMods.length !== 1 ? "s" : ""}</Text>
                {catTotal > 0 && <Text style={[mk.sectionTotal, { color: accentColor }]}>{fmt(catTotal)}</Text>}
                <View style={mk.sectionLine} />
              </View>
              {catMods.map((mod, i) => (
                <View key={mod.id} style={[mk.modRow, i % 2 === 1 ? mk.modRowAlt : {}]}>
                  <View style={mk.modName}>
                    <Text>{mod.name}</Text>
                    {(mod.brand || mod.vendor) && (
                      <Text style={{ fontSize: 7, color: "#888", marginTop: 1 }}>
                        {[mod.brand, mod.vendor].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </View>
                  <View style={mk.modMeta}>
                    {mod.installDate && <Text>Installed {fmtDate(mod.installDate)}</Text>}
                    {mod.difficulty && <Text style={{ color: "#999" }}>{mod.difficulty.charAt(0) + mod.difficulty.slice(1).toLowerCase()} install</Text>}
                  </View>
                  <View style={[mk.modStatus, { backgroundColor: STATUS_COLOR[mod.status] ?? "#888" }]}>
                    <Text>{STATUS_LABEL[mod.status] ?? mod.status}</Text>
                  </View>
                  <Text style={mk.modPrice}>{fmt(mod.actualPrice ?? mod.price)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Maintenance */}
        {vehicle.maintenanceLogs.length > 0 && (
          <View>
            <View style={[mk.sectionHeader, { marginTop: 18 }]}>
              <Text style={[mk.sectionTitle, { color: "#444" }]}>Service History</Text>
              <Text style={mk.sectionCount}>{vehicle.maintenanceLogs.length} record{vehicle.maintenanceLogs.length !== 1 ? "s" : ""}</Text>
              <View style={mk.sectionLine} />
            </View>
            {vehicle.maintenanceLogs.map((log, i) => (
              <View key={log.id} style={[mk.maintRow, i % 2 === 1 ? mk.modRowAlt : {}]}>
                <View style={mk.maintService}>
                  <Text>{log.service}</Text>
                  {log.notes && <Text style={{ fontSize: 7, color: "#888", marginTop: 1 }}>{log.notes}</Text>}
                </View>
                <View style={mk.maintDate}>
                  <Text>{fmtDate(log.date)}</Text>
                  {log.mileage != null && <Text style={{ color: "#999" }}>{log.mileage.toLocaleString()} mi · {log.diy ? "DIY" : log.shop ?? ""}</Text>}
                </View>
                <Text style={mk.maintCost}>{fmt(log.cost)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Journal/Notes */}
        {vehicle.notes && (
          <View style={mk.notesBox}>
            <Text style={[mk.sectionTitle, { color: "#444", marginBottom: 6 }]}>Build Journal</Text>
            <Text style={mk.notesText}>{vehicle.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={mk.footer} fixed>
          <Text style={mk.footerText}>BuildVerse — {vehicleTitle}</Text>
          <Text style={mk.footerText}>Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</Text>
          <Text style={mk.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
