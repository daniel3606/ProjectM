import FamilyControls
import ManagedSettings
import SwiftUI

// The three pieces of the Stats screen that only this extension can draw.
// Each mirrors the React Native component it sits inside, so the seam between
// what the app knows and what only iOS knows isn't visible to the user:
//
//   ScreenTimeTotalView  -> the Screen Time column of SummaryCard
//   MostUsedAppsView     -> the Most Used Apps column of SummaryCard
//   AppUsageListView     -> the whole card in AppUsageCard
//
// Sizes are fixed by the host, which has to reserve the space before iOS has
// resolved anything — the same constraint ScreenTimeSelectionListView works
// under, and the reason nothing here reports its own height.

private let noChangeThreshold = 0.005

/// "↑ 18%" / "↓ 4%", matching changeLabel in lib/stats/summary.ts. Screen time
/// going down is progress, so the tone is inverted against the arrow.
private struct Change {
    let text: String
    let color: Color

    init?(current: TimeInterval, previous: TimeInterval) {
        guard previous > 0 else { return nil }
        let fraction = (current - previous) / previous
        if abs(fraction) < noChangeThreshold {
            text = "No change"
            color = ReportPalette.textSecondary
            return
        }
        let up = fraction > 0
        text = "\(up ? "↑" : "↓") \(Int((abs(fraction) * 100).rounded()))%"
        color = up ? ReportPalette.attention : ReportPalette.positive
    }
}

// MARK: - Summary stats

/// Both columns the report owns, drawn together. Kept as one view because each
/// DeviceActivityReport on screen is its own extension instance walking the
/// same data — two of them competing was enough to leave one blank.
struct SummaryStatsView: View {
    let summary: UsageSummary

    var body: some View {
        HStack(spacing: 0) {
            ScreenTimeColumn(summary: summary)

            Rectangle()
                .fill(ReportPalette.divider)
                .frame(width: 1)
                .padding(.horizontal, 8)

            MostUsedColumn(summary: summary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .unredacted()
        .environment(\.redactionReasons, [])
        .privacySensitive(false)
    }
}

private struct ScreenTimeColumn: View {
    let summary: UsageSummary

    var body: some View {
        VStack(spacing: 3) {
            Text("Screen Time")
                .font(ReportFont.rounded(12.5, .medium))
                .foregroundColor(ReportPalette.text)

            Text(summary.hasData ? formatMinutes(Int(summary.current / 60)) : "—")
                .font(ReportFont.rounded(17, .semibold))
                .foregroundColor(ReportPalette.text)
                .padding(.top, 4)

            if let change = Change(current: summary.current, previous: summary.previous) {
                Text(change.text)
                    .font(ReportFont.rounded(12.5, .medium))
                    .foregroundColor(change.color)
            } else {
                Text(summary.hasData ? "—" : "No data")
                    .font(ReportFont.rounded(12.5, .medium))
                    .foregroundColor(ReportPalette.textSecondary)
            }
        }
        // maxHeight matters as much as maxWidth: without it SwiftUI centres the
        // column in the height the host reserved, and it sits lower than the
        // React Native column next to it.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

private struct MostUsedColumn: View {
    let summary: UsageSummary

    private let iconSize: CGFloat = 34
    /// Roughly a third of the icon, so they read as a stack rather than a row.
    private let overlap: CGFloat = -13
    private let count = 3

    var body: some View {
        VStack(spacing: 3) {
            Text("Most Used Apps")
                .font(ReportFont.rounded(12.5, .medium))
                .foregroundColor(ReportPalette.text)
                .multilineTextAlignment(.center)
                // The column is narrower than the label, so it has to wrap
                // rather than run past both edges of its third of the card.
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            if summary.apps.isEmpty {
                Text(summary.hasData ? "Nothing yet" : "No data")
                    .font(ReportFont.rounded(12.5, .medium))
                    .foregroundColor(ReportPalette.textSecondary)
                    .padding(.top, 6)
            } else {
                HStack(spacing: overlap) {
                    ForEach(
                        Array(summary.apps.prefix(count).enumerated()),
                        id: \.element.id
                    ) { index, app in
                        AppIcon(token: app.token, size: iconSize)
                            // Later views in an HStack draw on top by default,
                            // which stacks the least-used app over the rest.
                            .zIndex(Double(count - index))
                    }
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - App usage list

struct AppUsageListView: View {
    let summary: UsageSummary
    let limit: Int

    static let rowHeight: CGFloat = 62
    private let iconSize: CGFloat = 38

    private var rows: [UsageEntry] {
        Array(summary.apps.prefix(limit))
    }

    private var peakSeconds: TimeInterval {
        rows.first?.seconds ?? 0
    }

    var body: some View {
        VStack(spacing: 0) {
            if rows.isEmpty {
                Text(
                    summary.hasData
                        ? "No app usage in this window."
                        : "Screen Time hasn't shared any usage yet."
                )
                .font(ReportFont.rounded(14, .regular))
                .foregroundColor(ReportPalette.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 20)
            } else {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, app in
                    row(app, showDivider: index > 0)
                }
            }
        }
        // Without maxHeight the rows are centred in the height the host
        // reserved, which is what put an equal gap above and below them.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .unredacted()
        .environment(\.redactionReasons, [])
        .privacySensitive(false)
    }

    private func row(_ app: UsageEntry, showDivider: Bool) -> some View {
        HStack(spacing: 12) {
            AppIcon(token: app.token, size: iconSize)

            VStack(alignment: .leading, spacing: 6) {
                Text(app.name)
                    .font(ReportFont.rounded(15.5, .medium))
                    .foregroundColor(ReportPalette.text)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Capsule().fill(ReportPalette.track)
                            Capsule()
                                .fill(ReportPalette.secondaryLight)
                                .frame(width: max(4, geometry.size.width * share(app)))
                        }
                    }
                    .frame(height: 4)

                    Text(formatMinutes(app.minutes))
                        .font(ReportFont.rounded(13, .medium))
                        .foregroundColor(ReportPalette.textSecondary)
                        .frame(width: 56, alignment: .trailing)
                }
            }
        }
        .frame(height: Self.rowHeight)
        .overlay(alignment: .top) {
            if showDivider {
                Rectangle()
                    .fill(ReportPalette.divider)
                    .frame(height: 1 / UIScreen.main.scale)
            }
        }
    }

    /// Rows scale against the busiest app rather than the window total, so the
    /// longest bar always fills its track — the same rule computeAppUsage uses.
    private func share(_ app: UsageEntry) -> Double {
        guard peakSeconds > 0 else { return 0 }
        return app.seconds / peakSeconds
    }
}

// MARK: - Icon

/// A token draws the real icon; without one there is nothing to draw, so the
/// slot stays empty at the same size rather than collapsing the row.
private struct AppIcon: View {
    let token: ApplicationToken?
    let size: CGFloat

    @ViewBuilder
    var body: some View {
        if let token {
            // No clip shape: iOS already draws the icon with its own corners,
            // and rounding it again shaves them.
            Label(token)
                .labelStyle(.iconOnly)
                .frame(width: size, height: size)
        } else {
            RoundedRectangle(cornerRadius: size * 0.225, style: .continuous)
                .fill(ReportPalette.track)
                .frame(width: size, height: size)
        }
    }
}
