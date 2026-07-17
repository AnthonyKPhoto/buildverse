import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { BuildSheetOptions } from "./PDFExportDialog";

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
  drivetrain?: string; mileage?: number; color?: string; photoUrl?: string;
  notes?: string;
  modifications: Modification[];
  maintenanceLogs: MaintenanceLog[];
}

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned", RESEARCHING: "Researching / Idea", ORDERED: "Ordered",
  PURCHASED: "Purchased", INSTALLED: "Installed", REMOVED: "Removed",
};
const STATUS_COLOR: Record<string, string> = {
  PLANNED: "#64748b", RESEARCHING: "#3b82f6", ORDERED: "#eab308",
  PURCHASED: "#a855f7", INSTALLED: "#22c55e", REMOVED: "#ef4444",
};

const STYLE_THEMES = {
  modern: {
    pageBg: "#ffffff", boxBg: "#f5f5f5", text: "#1a1a1a", subtext: "#555",
    border: "#e0e0e0", rowAlt: "#fafafa", specBg: "#f9f9f9",
  },
  minimal: {
    pageBg: "#ffffff", boxBg: "#ffffff", text: "#000000", subtext: "#444",
    border: "#bbbbbb", rowAlt: "#ffffff", specBg: "#ffffff",
  },
  classic: {
    pageBg: "#f9f7f2", boxBg: "#ece9e0", text: "#1a1510", subtext: "#4a3f30",
    border: "#c8b890", rowAlt: "#f4f1ea", specBg: "#ece9e0",
  },
};

const FONT_MAP = {
  "Helvetica":   { body: "Helvetica",   bold: "Helvetica-Bold" },
  "Times-Roman": { body: "Times-Roman", bold: "Times-Bold" },
  "Courier":     { body: "Courier",     bold: "Courier-Bold" },
} as const;

const PLANNED_STATUSES = new Set(["PLANNED", "RESEARCHING", "ORDERED", "PURCHASED"]);

function fmt(n?: number | null) {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(s?: string | null) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return s; }
}

export function BuildSheetDocument({
  vehicle,
  accentColor = "#e84d3d",
  options = {
    includeInstalled: true, includePlanned: true, includeCarPhoto: true,
    includeJournal: true, font: "Helvetica", style: "modern",
  },
}: {
  vehicle: Vehicle;
  accentColor?: string;
  options?: BuildSheetOptions;
}) {
  const theme = STYLE_THEMES[options.style] ?? STYLE_THEMES.modern;
  const fonts = FONT_MAP[options.font] ?? FONT_MAP["Helvetica"];

  // Filter mods based on options
  const filteredMods = vehicle.modifications.filter((m) => {
    if (m.status === "INSTALLED")             return options.includeInstalled;
    if (PLANNED_STATUSES.has(m.status))       return options.includePlanned;
    return false; // REMOVED — not included
  });

  const installedValue = filteredMods.filter(m => m.status === "INSTALLED").reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const plannedValue   = filteredMods.filter(m => m.status !== "INSTALLED").reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const totalValue     = filteredMods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const allMods        = vehicle.modifications;
  const installCount   = allMods.filter(m => m.status === "INSTALLED").length;
  const completion     = allMods.length > 0 ? Math.round((installCount / allMods.length) * 100) : 0;

  const modsByCategory = filteredMods.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const vehicleTitle = vehicle.name || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const vehicleSub   = vehicle.name
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}`
    : vehicle.trim || "";

  const specs: Array<{ label: string; value: string }> = [
    vehicle.engine       ? { label: "Engine",       value: vehicle.engine }       : null,
    vehicle.transmission ? { label: "Transmission", value: vehicle.transmission } : null,
    vehicle.drivetrain   ? { label: "Drivetrain",   value: vehicle.drivetrain }   : null,
    vehicle.platform     ? { label: "Platform",     value: vehicle.platform }     : null,
    vehicle.color        ? { label: "Color",        value: vehicle.color }        : null,
    vehicle.mileage != null ? { label: "Mileage",  value: vehicle.mileage.toLocaleString() + " mi" } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Only include photo if it's a data URI or absolute HTTPS URL (safe for @react-pdf)
  const photoSrc =
    options.includeCarPhoto && vehicle.photoUrl &&
    (vehicle.photoUrl.startsWith("data:") || /^https?:\/\//i.test(vehicle.photoUrl))
      ? vehicle.photoUrl
      : null;

  const showJournal = options.includeJournal && !!(vehicle.notes?.trim());

  // Dynamic styles dependent on theme/font
  const mk = StyleSheet.create({
    page: {
      fontFamily: fonts.body,
      fontSize: 8.5,
      color: theme.text,
      backgroundColor: theme.pageBg,
      paddingTop: 36,
      paddingBottom: 48,
      paddingHorizontal: 40,
    },
    headerBar:   { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    headerLeft:  { flex: 1 },
    vehicleName: { fontSize: 20, fontFamily: fonts.bold, color: theme.text, lineHeight: 1.1 },
    vehicleSub:  { fontSize: 10, color: theme.subtext, marginTop: 2 },
    headerRight: { alignItems: "flex-end" },
    buildLabel:  { fontSize: 7, color: theme.subtext, textTransform: "uppercase", letterSpacing: 1 },
    buildValue:  { fontSize: 22, fontFamily: fonts.bold, marginTop: 1 },
    divider:     { height: 2, borderRadius: 1, marginBottom: 16 },

    photo:       { width: "100%", height: 180, objectFit: "cover", borderRadius: 4, marginBottom: 16 },

    statsRow:    { flexDirection: "row", gap: 8, marginBottom: 20 },
    statBox:     { flex: 1, backgroundColor: theme.boxBg, borderRadius: 4, padding: 8, borderWidth: options.style === "minimal" ? 0.5 : 0, borderColor: theme.border },
    statLabel:   { fontSize: 6.5, color: theme.subtext, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
    statValue:   { fontSize: 13, fontFamily: fonts.bold, color: theme.text },

    specsGrid:   { flexDirection: "row", flexWrap: "wrap", backgroundColor: theme.specBg, borderRadius: 4, padding: 10, marginBottom: 20, borderWidth: options.style === "minimal" ? 0.5 : 0, borderColor: theme.border },
    specItem:    { width: "25%", paddingVertical: 3, paddingHorizontal: 4 },
    specLabel:   { fontSize: 6.5, color: theme.subtext, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 1.5 },
    specValue:   { fontSize: 8.5, fontFamily: fonts.bold, color: theme.text },

    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6, marginTop: 14 },
    sectionTitle:  { fontSize: 9, fontFamily: fonts.bold, textTransform: "uppercase", letterSpacing: 1 },
    sectionCount:  { marginLeft: 6, fontSize: 7.5, color: theme.subtext },
    sectionTotal:  { marginLeft: 6, fontSize: 7.5, fontFamily: fonts.bold },
    sectionLine:   { flex: 1, height: 0.5, backgroundColor: theme.border, marginLeft: 8 },

    modRow:      { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingVertical: 4.5, paddingHorizontal: 4, alignItems: "center" },
    modRowAlt:   { backgroundColor: theme.rowAlt },
    modName:     { flex: 3, fontSize: 8.5, fontFamily: fonts.bold, color: theme.text },
    modMeta:     { flex: 2, fontSize: 7.5, color: theme.subtext },
    modStatus:   { width: 60, fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 10, textAlign: "center", color: "#fff" },
    modPrice:    { width: 54, fontSize: 8.5, fontFamily: fonts.bold, textAlign: "right", color: theme.text },

    maintRow:    { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: theme.border, paddingVertical: 4, paddingHorizontal: 4, alignItems: "center" },
    maintService: { flex: 3, fontSize: 8.5, fontFamily: fonts.bold, color: theme.text },
    maintDate:   { flex: 2, fontSize: 7.5, color: theme.subtext },
    maintCost:   { width: 54, fontSize: 8.5, fontFamily: fonts.bold, textAlign: "right", color: theme.text },

    notesBox:    { backgroundColor: theme.specBg, borderRadius: 4, padding: 10, marginTop: 14, borderWidth: options.style === "minimal" ? 0.5 : 0, borderColor: theme.border },
    notesText:   { fontSize: 8, color: theme.subtext, lineHeight: 1.6 },

    footer:      { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    footerText:  { fontSize: 7, color: "#aaa" },
  });

  const Footer = () => (
    <View style={mk.footer} fixed>
      <Text style={mk.footerText}>BuildVerse — {vehicleTitle}</Text>
      <Text style={mk.footerText}>
        Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </Text>
      <Text style={mk.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );

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

        {/* Vehicle photo (optional) */}
        {photoSrc ? <Image src={photoSrc} style={mk.photo} /> : null}

        {/* Stats */}
        <View style={mk.statsRow}>
          {options.includeInstalled && (
            <View style={mk.statBox}>
              <Text style={mk.statLabel}>Installed Value</Text>
              <Text style={[mk.statValue, { color: "#22c55e" }]}>{fmt(installedValue)}</Text>
            </View>
          )}
          {options.includePlanned && (
            <View style={mk.statBox}>
              <Text style={mk.statLabel}>Planned Spend</Text>
              <Text style={[mk.statValue, { color: accentColor }]}>{fmt(plannedValue)}</Text>
            </View>
          )}
          <View style={mk.statBox}>
            <Text style={mk.statLabel}>Total Build</Text>
            <Text style={[mk.statValue, { color: theme.text }]}>{fmt(totalValue)}</Text>
          </View>
          <View style={mk.statBox}>
            <Text style={mk.statLabel}>Total Mods</Text>
            <Text style={[mk.statValue, { color: theme.text }]}>{String(allMods.length)}</Text>
          </View>
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

        {/* Modifications by category */}
        {Object.entries(modsByCategory).map(([cat, catMods]) => {
          const catTotal = catMods.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
          return (
            <View key={cat} wrap={false}>
              <View style={mk.sectionHeader}>
                <Text style={[mk.sectionTitle, { color: theme.subtext }]}>{cat}</Text>
                <Text style={mk.sectionCount}>{catMods.length} mod{catMods.length !== 1 ? "s" : ""}</Text>
                {catTotal > 0 && <Text style={[mk.sectionTotal, { color: accentColor }]}>{fmt(catTotal)}</Text>}
                <View style={mk.sectionLine} />
              </View>
              {catMods.map((mod, i) => (
                <View key={mod.id} style={[mk.modRow, i % 2 === 1 ? mk.modRowAlt : {}]}>
                  <View style={mk.modName}>
                    <Text>{mod.name}</Text>
                    {(mod.brand || mod.vendor) && (
                      <Text style={{ fontSize: 7, color: theme.subtext, marginTop: 1 }}>
                        {[mod.brand, mod.vendor].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </View>
                  <View style={mk.modMeta}>
                    {mod.installDate && <Text>Installed {fmtDate(mod.installDate)}</Text>}
                    {mod.difficulty && (
                      <Text style={{ color: theme.subtext }}>
                        {mod.difficulty.charAt(0) + mod.difficulty.slice(1).toLowerCase()} install
                      </Text>
                    )}
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
              <Text style={[mk.sectionTitle, { color: theme.subtext }]}>Service History</Text>
              <Text style={mk.sectionCount}>
                {vehicle.maintenanceLogs.length} record{vehicle.maintenanceLogs.length !== 1 ? "s" : ""}
              </Text>
              <View style={mk.sectionLine} />
            </View>
            {vehicle.maintenanceLogs.map((log, i) => (
              <View key={log.id} style={[mk.maintRow, i % 2 === 1 ? mk.modRowAlt : {}]}>
                <View style={mk.maintService}>
                  <Text>{log.service}</Text>
                  {log.notes && <Text style={{ fontSize: 7, color: theme.subtext, marginTop: 1 }}>{log.notes}</Text>}
                </View>
                <View style={mk.maintDate}>
                  <Text>{fmtDate(log.date)}</Text>
                  {log.mileage != null && (
                    <Text style={{ color: theme.subtext }}>
                      {log.mileage.toLocaleString()} mi · {log.diy ? "DIY" : log.shop ?? ""}
                    </Text>
                  )}
                </View>
                <Text style={mk.maintCost}>{fmt(log.cost)}</Text>
              </View>
            ))}
          </View>
        )}

        <Footer />
      </Page>

      {/* Journal — own dedicated page */}
      {showJournal && (
        <Page size="A4" style={mk.page}>
          <View style={mk.headerBar}>
            <View style={mk.headerLeft}>
              <Text style={mk.vehicleName}>Build Journal</Text>
              <Text style={mk.vehicleSub}>{vehicleTitle}</Text>
            </View>
          </View>
          <View style={[mk.divider, { backgroundColor: accentColor }]} />
          <Text style={[mk.notesText, { marginTop: 12, lineHeight: 1.8 }]}>{vehicle.notes}</Text>
          <Footer />
        </Page>
      )}
    </Document>
  );
}
