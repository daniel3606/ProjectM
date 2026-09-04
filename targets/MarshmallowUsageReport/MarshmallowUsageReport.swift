import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

// Runs inside the MarshmallowUsageReport app extension.
//
// This is the only place in the product that can see real screen-time
// figures. iOS hands `DeviceActivityResults` to a report extension and
// sandboxes it so nothing can carry those figures back out — no network, and
// the App Group is not a way around it. The extension therefore draws the
// numbers itself, and the app hosts the result through `DeviceActivityReport`
// (see ScreenTimeUsageReportView).
//
// Everything the app *does* know — growth, blocked minutes — stays in React
// Native and is laid out around this view rather than passed into it. Reading
// the App Group from here is allowed, and StatsPalette does exactly that for
// nothing more sensitive than colours.
//
// The only channel from the app into this extension is the context name, so
// each variation the app can ask for is registered below as its own scene.

@main
struct MarshmallowUsageReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene {
        SummaryStatsScene()
        AppUsageListScene()
    }
}

extension DeviceActivityReport.Context {
    static let summaryStats = Self("marshmallow.summaryStats")
    static let appUsageList = Self("marshmallow.appUsageList")
}

// MARK: - Shared data shapes

/// One app's total for the window, already reduced out of the async results.
struct UsageEntry: Identifiable {
    let id: String
    let name: String
    let token: ApplicationToken?
    let seconds: TimeInterval

    var minutes: Int { Int((seconds / 60).rounded()) }
}

/// The window's totals, split so a comparison can be drawn against the one
/// before it. The filter the app passes covers both.
struct UsageSummary {
    var current: TimeInterval = 0
    var previous: TimeInterval = 0
    var apps: [UsageEntry] = []
    /// True once any segment was seen at all; false means "nothing measured".
    var hasData = false
}

/// Splits the filter's span down the middle: the app always asks for the
/// window it is showing plus the equally sized one before it, so the midpoint
/// is the boundary between them.
private func summarize(
    _ data: DeviceActivityResults<DeviceActivityData>,
    boundary: Date
) async -> UsageSummary {
    var summary = UsageSummary()
    var totals: [String: UsageEntry] = [:]

    for await result in data {
        for await segment in result.activitySegments {
            summary.hasData = true

            // A segment already knows its own total, so the comparison window
            // costs one read instead of a walk over every category and app in
            // it. That walk was most of the extension's work, and overrunning
            // its budget is what left the view blank.
            guard segment.dateInterval.start >= boundary else {
                summary.previous += segment.totalActivityDuration
                continue
            }
            summary.current += segment.totalActivityDuration

            for await category in segment.categories {
                for await app in category.applications {
                    let seconds = app.totalActivityDuration
                    guard seconds > 0 else { continue }

                    // Bundle identifier is the only stable key; an app without
                    // one still has a token to draw and is kept under its name.
                    let key = app.application.bundleIdentifier
                        ?? app.application.localizedDisplayName
                        ?? UUID().uuidString
                    let existing = totals[key]
                    totals[key] = UsageEntry(
                        id: key,
                        name: app.application.localizedDisplayName ?? "App",
                        token: app.application.token ?? existing?.token,
                        seconds: (existing?.seconds ?? 0) + seconds
                    )
                }
            }
        }
    }

    summary.apps = totals.values.sorted { $0.seconds > $1.seconds }
    return summary
}

/// "1h 53m", "12m" — the same shape as formatMinutes in lib/stats/format.ts,
/// so a figure drawn here reads identically to one drawn in React Native.
func formatMinutes(_ totalMinutes: Int) -> String {
    let minutes = max(0, totalMinutes)
    let h = minutes / 60
    let m = minutes % 60
    if h == 0 { return "\(m)m" }
    if m == 0 { return "\(h)h" }
    return "\(h)h \(m)m"
}

// MARK: - Scenes

struct SummaryStatsScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .summaryStats
    let content: (UsageSummary) -> SummaryStatsView = SummaryStatsView.init

    func makeConfiguration(
        representing data: DeviceActivityResults<DeviceActivityData>
    ) async -> UsageSummary {
        await summarize(data, boundary: ReportWindow.boundary)
    }
}

struct AppUsageListScene: DeviceActivityReportScene {
    /// Matches REPORT_ROWS in components/stats/UsageReport.tsx, which reserves
    /// the height these rows are drawn into.
    static let rowLimit = 8

    let context: DeviceActivityReport.Context = .appUsageList
    let content: (UsageSummary) -> AppUsageListView = {
        AppUsageListView(summary: $0, limit: AppUsageListScene.rowLimit)
    }

    func makeConfiguration(
        representing data: DeviceActivityResults<DeviceActivityData>
    ) async -> UsageSummary {
        await summarize(data, boundary: ReportWindow.boundary)
    }
}
