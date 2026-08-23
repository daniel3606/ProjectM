import ActivityKit
import Foundation

// Shared between the main app (ScreenTimeModule) and the QuickBlockLiveActivity
// widget extension. Copied into the extension target at prebuild time by
// withQuickBlockLiveActivity.js — keep it self-contained.
struct QuickBlockAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startedAt: Date
        var endsAt: Date
    }

    /// Display label, e.g. "Focus Block".
    var label: String
    /// "flexible" or "deep" — shown as a subtitle on the Live Activity.
    var focusMode: String
}
