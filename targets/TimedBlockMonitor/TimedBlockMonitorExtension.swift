import ActivityKit
import DeviceActivity
import FamilyControls
import ManagedSettings
import UserNotifications
import WidgetKit

// Runs inside the TimedBlockMonitor app extension, invoked by iOS itself at
// the start/end of each DeviceActivitySchedule registered from
// ScreenTimeModule.scheduleTimedBlocks — independent of whether the main app
// is running. This is what lets a Timed Block actually start when the app
// was never opened.
class TimedBlockMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore()

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)

        SharedBlockState.defaults.synchronize()
        guard let plan = loadPlan(id: activity.rawValue) else { return }

        // DeviceActivitySchedule has no day-of-week filter, so every plan is
        // registered daily and this extension is the one place that can
        // check "is today actually one of the plan's days" before shielding.
        let weekday = Calendar.current.component(.weekday, from: Date()) - 1 // 0 = Sunday
        guard plan.daysOfWeek.contains(weekday) else { return }

        applyShield(for: plan)

        let defaults = SharedBlockState.defaults
        defaults.set(plan.id, forKey: SharedBlockState.activePlanIdKey)
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: SharedBlockState.activeStartedAtKey)
        defaults.set(plan.durationMinutes, forKey: SharedBlockState.activeDurationMinutesKey)
        defaults.set(plan.label, forKey: SharedBlockState.activeLabelKey)
        defaults.set(plan.expectedGrowthCm ?? 0, forKey: SharedBlockState.activeGrowthCmKey)
        defaults.synchronize()
        WidgetCenter.shared.reloadAllTimelines()

        startLiveActivity(for: plan)

        notify(title: "Timed Block Started", body: "\"\(plan.label)\" is now blocking your apps.")
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)

        SharedBlockState.defaults.synchronize()
        guard let plan = loadPlan(id: activity.rawValue) else { return }
        let defaults = SharedBlockState.defaults

        // Only clear if this plan is the one we marked active — guards
        // against clobbering a different plan's still-running block if two
        // schedules ever overlap.
        if defaults.string(forKey: SharedBlockState.activePlanIdKey) == plan.id {
            store.clearAllSettings()
            defaults.removeObject(forKey: SharedBlockState.activePlanIdKey)
            defaults.removeObject(forKey: SharedBlockState.activeStartedAtKey)
            defaults.removeObject(forKey: SharedBlockState.activeDurationMinutesKey)
            defaults.removeObject(forKey: SharedBlockState.activeLabelKey)
            defaults.removeObject(forKey: SharedBlockState.activeGrowthCmKey)
            defaults.synchronize()
            WidgetCenter.shared.reloadAllTimelines()
            endLiveActivity()
        }

        notify(title: "Block Ended", body: "\"\(plan.label)\" has ended. Apps are unblocked.")
    }

    // Puts the block on the Lock Screen / Notification Center the moment it
    // starts, instead of only once the app is next opened. Best-effort:
    // ActivityKit can refuse a request from an extension, and the app raises
    // the same Live Activity on launch when it adopts the running block.
    private func startLiveActivity(for plan: StoredPlan) {
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let startedAt = Date()
        let endsAt = startedAt.addingTimeInterval(Double(plan.durationMinutes) * 60)

        // A previous block's activity would otherwise linger next to this one.
        endLiveActivity()

        let attributes = BlockAttributes(label: plan.label, focusMode: plan.focusMode ?? "flexible")
        let state = BlockAttributes.ContentState(startedAt: startedAt, endsAt: endsAt)

        _ = try? Activity.request(
            attributes: attributes,
            content: .init(state: state, staleDate: endsAt),
            pushType: nil
        )
    }

    private func endLiveActivity() {
        guard #available(iOS 16.2, *) else { return }
        for activity in Activity<BlockAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }

    private func loadPlan(id: String) -> StoredPlan? {
        guard
            let data = SharedBlockState.defaults.data(forKey: SharedBlockState.planMetadataKey),
            let plans = try? JSONDecoder().decode([StoredPlan].self, from: data)
        else { return nil }
        return plans.first { $0.id == id }
    }

    // Mirrors ScreenTimeModule.applyBlocking()/blockAll()'s id -> token
    // mapping so a plan's chosen apps/categories/domains match what's shown
    // in the app's own picker UI.
    private func applyShield(for plan: StoredPlan) {
        guard
            let selectionData = SharedBlockState.defaults.data(forKey: SharedBlockState.selectionKey),
            let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: selectionData)
        else { return }

        if plan.blockMode == "allowOnly" {
            applyAllowOnlyShield(selection: selection, allowedIds: Set(plan.appIds))
            return
        }

        if plan.appIds.isEmpty {
            if !selection.applicationTokens.isEmpty { store.shield.applications = selection.applicationTokens }
            if !selection.categoryTokens.isEmpty {
                store.shield.applicationCategories = .specific(selection.categoryTokens, except: Set())
            }
            if !selection.webDomainTokens.isEmpty { store.shield.webDomains = selection.webDomainTokens }
            return
        }

        let selectedIds = Set(plan.appIds)
        var appTokens = Set<ApplicationToken>()
        var categoryTokens = Set<ActivityCategoryToken>()
        var webTokens = Set<WebDomainToken>()

        let appArray = Array(selection.applicationTokens)
        let catArray = Array(selection.categoryTokens)
        let webArray = Array(selection.webDomainTokens)

        for id in selectedIds {
            if id.hasPrefix("app_"), let index = Int(id.dropFirst(4)), index < appArray.count {
                appTokens.insert(appArray[index])
            } else if id.hasPrefix("cat_"), let index = Int(id.dropFirst(4)), index < catArray.count {
                categoryTokens.insert(catArray[index])
            } else if id.hasPrefix("web_"), let index = Int(id.dropFirst(4)), index < webArray.count {
                webTokens.insert(webArray[index])
            }
        }

        store.shield.applications = appTokens.isEmpty ? nil : appTokens
        store.shield.applicationCategories = categoryTokens.isEmpty ? nil : .specific(categoryTokens, except: Set())
        store.shield.webDomains = webTokens.isEmpty ? nil : webTokens
    }

    private func applyAllowOnlyShield(selection: FamilyActivitySelection, allowedIds: Set<String>) {
        var allowedApps = Set<ApplicationToken>()
        var allowedWebs = Set<WebDomainToken>()

        let appArray = Array(selection.applicationTokens)
        let webArray = Array(selection.webDomainTokens)

        for id in allowedIds {
            if id.hasPrefix("app_"), let index = Int(id.dropFirst(4)), index < appArray.count {
                allowedApps.insert(appArray[index])
            } else if id.hasPrefix("web_"), let index = Int(id.dropFirst(4)), index < webArray.count {
                allowedWebs.insert(webArray[index])
            }
        }

        store.shield.applications = nil
        store.shield.applicationCategories = .all(except: allowedApps)
        store.shield.webDomains = nil
        store.shield.webDomainCategories = .all(except: allowedWebs)
    }

    private func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
