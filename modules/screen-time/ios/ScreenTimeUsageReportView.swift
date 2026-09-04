import DeviceActivity
import ExpoModulesCore
import SwiftUI

// Hosts a DeviceActivityReport, which is the only way real screen-time
// figures ever reach the screen. The numbers are drawn by the
// MarshmallowUsageReport extension and never enter this process — see that
// target for why.
//
// All this side chooses is *which* report to show (the context) and *what
// window* it covers (the filter). Both are set from React Native, so the
// Stats screen keeps deciding what it is looking at.
//
// The filter deliberately spans the shown window plus the equally sized one
// before it, because the extension has to compute its own comparison. Where
// the two meet is written to the App Group first — the context name is the
// only other thing that crosses, and it is already carrying the layout
// variant.

@available(iOS 16.0, *)
private struct UsageReportContent: View {
    let context: String
    let start: Date
    let end: Date

    let segment: String

    private var interval: DateInterval {
        DateInterval(start: start, end: end)
    }

    /// A year of daily segments is thousands of async iterations for a chart
    /// that only needs weeks, so the app picks the granularity it can use.
    private var filterSegment: DeviceActivityFilter.SegmentInterval {
        switch segment {
        case "hourly": return .hourly(during: interval)
        case "weekly": return .weekly(during: interval)
        default: return .daily(during: interval)
        }
    }

    var body: some View {
        DeviceActivityReport(
            DeviceActivityReport.Context(context),
            filter: DeviceActivityFilter(
                segment: filterSegment,
                users: .all,
                devices: .init([.iPhone, .iPad])
            )
        )
    }
}

final class ScreenTimeUsageReportView: ScreenTimeHostingView {
    /// Name registered by a scene in the report extension.
    var reportContext: String = ""
    /// Start of the *comparison* window, in ms — the filter's left edge.
    var startMs: Double = 0
    /// End of the shown window, in ms — the filter's right edge.
    var endMs: Double = 0
    /// Where the comparison window ends and the shown one begins, in ms.
    var boundaryMs: Double = 0
    /// "hourly", "daily" or "weekly" — how finely the filter is segmented.
    var segment: String = "daily"

    /// True once the report was hosted while the view was genuinely on screen.
    private var hostedLive = false

    /// A DeviceActivityReport is an out-of-process view: it only connects to
    /// the extension once it is in a window, under a parent view controller,
    /// at a real size. React Native sets props before any of that is true, so
    /// the first attempt usually produces a view that stays blank and never
    /// retries — which is why switching tabs and coming back "fixed" it.
    private var isOnScreen: Bool {
        window != nil && !bounds.isEmpty
    }

    private func hostWhenOnScreen() {
        guard !hostedLive, isOnScreen else { return }
        // A first attempt made off screen never connected, so this one starts
        // the hosting controller from scratch rather than reusing it.
        detach()
        rebuild()
    }

    override func didMoveToWindow() {
        // Re-parents the hosting controller, which has to happen before the
        // report is rebuilt under it.
        super.didMoveToWindow()

        guard window != nil else {
            // Leaving the hierarchy makes the connection stale; hosting again
            // on the way back also picks up usage accrued while away.
            hostedLive = false
            return
        }
        hostWhenOnScreen()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // The first real size often lands after didMoveToWindow.
        hostWhenOnScreen()
    }

    func rebuild() {
        guard #available(iOS 16.0, *) else { return }
        guard !reportContext.isEmpty, endMs > startMs else { return }

        // Written before the report is asked for, so the extension reads the
        // boundary belonging to the window it is about to be handed.
        SharedBlockState.defaults.set(
            boundaryMs / 1000,
            forKey: SharedBlockState.usageReportBoundaryKey
        )
        SharedBlockState.defaults.synchronize()

        let content = UsageReportContent(
            context: reportContext,
            start: Date(timeIntervalSince1970: startMs / 1000),
            end: Date(timeIntervalSince1970: endMs / 1000),
            segment: segment
        )

        // Updating the root view rather than re-hosting. `host` tears the
        // hosting controller down and builds a new one, which for an
        // out-of-process view means dropping its connection to the extension
        // and starting over — every prop update was restarting the report
        // mid-load, which is what made it come and go.
        if let existing = hostingController as? UIHostingController<UsageReportContent> {
            existing.rootView = content
        } else {
            host(content)
        }

        // Only an attempt made on screen is worth keeping; anything earlier is
        // retried from didMoveToWindow/layoutSubviews.
        hostedLive = isOnScreen
    }
}
