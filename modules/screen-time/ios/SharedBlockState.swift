import Foundation

// Shared between the main app target (ScreenTimeModule) and the
// TimedBlockMonitor DeviceActivityMonitor extension. This exact file is
// duplicated into the extension's target folder by the
// `withTimedBlockMonitor` config plugin at prebuild time — keep it
// self-contained (no imports beyond Foundation) so it compiles cleanly in
// both places.
enum SharedBlockState {
    static let appGroupId = "group.com.dllim.marshmallow"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupId) ?? .standard
    }

    // Persisted FamilyActivitySelection (PropertyListEncoder-encoded), shared
    // so the extension can shield the same apps/categories/domains the user
    // picked in the main app.
    static let selectionKey = "marshmallow_screen_time_selection"

    // JSON-encoded [StoredPlan] describing every enabled Timed Block plan,
    // refreshed by ScreenTimeModule.scheduleTimedBlocks whenever plans change.
    static let planMetadataKey = "marshmallow_timed_block_plans"

    // JSON-encoded [String: ScheduleSnapshot] (activity id -> last-registered
    // schedule) so scheduleTimedBlocks can tell which plans actually changed
    // and only re-register those — see ScheduleSnapshot below.
    static let scheduleSnapshotsKey = "marshmallow_timed_block_schedule_snapshots"

    // Written by the extension when a scheduled block starts/ends, and by
    // ScreenTimeModule.setActiveNativeBlock for a JS-started block (Quick or
    // Timed), so the JS side can reconcile FocusSessionContext state after a
    // cold launch and the MarshmallowWidget extension can show a countdown
    // without the app running.
    static let activePlanIdKey = "marshmallow_active_native_plan_id"
    static let activeStartedAtKey = "marshmallow_active_native_started_at"
    static let activeDurationMinutesKey = "marshmallow_active_native_duration_minutes"
    static let activeLabelKey = "marshmallow_active_native_label"

    // The growth this block pays out if it runs to completion, so the widget
    // can show it as a pending "+x.x" alongside the current size. Growth is
    // only actually awarded by the app on completion.
    static let activeGrowthCmKey = "marshmallow_active_native_growth_cm"

    // Kept in sync from JS (FocusSessionContext/MarshmallowProfileContext)
    // purely for MarshmallowWidget to render without needing the app open.
    static let marshmallowSizeCmKey = "marshmallow_size_cm"
    static let marshmallowColorHexKey = "marshmallow_color_hex"

    // [String: String] of item slot -> emoji, already resolved from item ids
    // by the JS side so the widget doesn't duplicate constants/items.ts.
    static let marshmallowItemsKey = "marshmallow_items"
}

struct StoredPlan: Codable {
    let id: String
    let label: String
    let daysOfWeek: [Int] // 0 = Sunday ... 6 = Saturday, matches JS Date#getDay()
    let appIds: [String]
    let durationMinutes: Int
    // Optional so plans persisted before these fields existed still decode.
    let expectedGrowthCm: Double?
    /// "flexible" or "deep"; shown on the Live Activity the monitor raises.
    let focusMode: String?
}

// The subset of a plan that actually determines its DeviceActivitySchedule.
// Used only to detect real schedule changes between scheduleTimedBlocks
// calls — re-registering an unchanged schedule with the OS causes the
// TimedBlockMonitor extension to receive a spurious intervalDidEnd +
// intervalDidStart for any plan currently mid-interval, which duplicates the
// "Block Ended"/"Timed Block Started" notifications it sends.
struct ScheduleSnapshot: Codable, Equatable {
    let daysOfWeek: [Int]
    let startHour: Int
    let startMinute: Int
    let endHour: Int
    let endMinute: Int
}
