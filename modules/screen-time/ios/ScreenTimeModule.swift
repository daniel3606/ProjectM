import ExpoModulesCore
import SwiftUI
import FamilyControls
import ManagedSettings
import DeviceActivity

public class ScreenTimeModule: Module {
    // Lazily created so module load (app launch) does not instantiate
    // Family Controls types before JS has a chance to render.
    private var managedStore: ManagedSettingsStore?
    private var store: ManagedSettingsStore {
        if managedStore == nil {
            managedStore = ManagedSettingsStore()
        }
        return managedStore!
    }
    private var currentSelection = FamilyActivitySelection()

    public func definition() -> ModuleDefinition {
        Name("ScreenTimeModule")

        // Sync: returns true when running on iOS 16+
        Function("isAvailable") { () -> Bool in
            if #available(iOS 16.0, *) { return true }
            return false
        }

        // Sync: returns the current FamilyControls authorization state
        Function("getAuthorizationStatus") { () -> String in
            if #available(iOS 16.0, *) {
                switch AuthorizationCenter.shared.authorizationStatus {
                case .notDetermined: return "notDetermined"
                case .denied:        return "denied"
                case .approved:      return "approved"
                @unknown default:    return "unknown"
                }
            }
            return "unavailable"
        }

        // Async: triggers the Screen Time authorization prompt
        AsyncFunction("requestAuthorization") { (promise: Promise) in
            if #available(iOS 16.0, *) {
                Task {
                    do {
                        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                        promise.resolve(true)
                    } catch {
                        promise.reject("AUTH_ERROR", "Authorization failed: \(error.localizedDescription)")
                    }
                }
            } else {
                promise.reject("UNAVAILABLE", "Screen Time API requires iOS 16.0+")
            }
        }

        // Async: presents the native FamilyActivityPicker sheet.
        // Resolves with serialized selection items, or nil on cancel.
        AsyncFunction("openAppPicker") { (promise: Promise) in
            guard #available(iOS 16.0, *) else {
                promise.reject("UNAVAILABLE", "App picker requires iOS 16.0+")
                return
            }

            self.loadSelection()

            DispatchQueue.main.async {
                guard let windowScene = UIApplication.shared.connectedScenes
                        .compactMap({ $0 as? UIWindowScene }).first,
                      let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController
                else {
                    promise.reject("NO_VC", "Unable to find root view controller")
                    return
                }

                var topVC = rootVC
                while let presented = topVC.presentedViewController { topVC = presented }

                let pickerView = ScreenTimePickerView(
                    initialSelection: self.currentSelection,
                    onComplete: { selection in
                        self.currentSelection = selection
                        self.saveSelection()
                        let items = self.serializeSelection()
                        topVC.dismiss(animated: true) { promise.resolve(items) }
                    },
                    onCancel: {
                        topVC.dismiss(animated: true) { promise.resolve(nil) }
                    }
                )

                let hosting = UIHostingController(rootView: pickerView)
                hosting.modalPresentationStyle = .pageSheet
                topVC.present(hosting, animated: true)
            }
        }

        // Async: returns the persisted selection without opening the picker
        AsyncFunction("getSelectedItems") { (promise: Promise) in
            self.loadSelection()
            promise.resolve(self.serializeSelection())
        }

        // Async: shields only the items whose IDs are in `itemIds`
        AsyncFunction("applyBlocking") { (itemIds: [String], promise: Promise) in
            self.loadSelection()

            let allItems = self.serializeSelection()
            var appTokens      = Set<ApplicationToken>()
            var categoryTokens = Set<ActivityCategoryToken>()
            var webTokens      = Set<WebDomainToken>()

            let selectedIds   = Set(itemIds)
            let appArray      = Array(self.currentSelection.applicationTokens)
            let catArray      = Array(self.currentSelection.categoryTokens)
            let webArray      = Array(self.currentSelection.webDomainTokens)

            for item in allItems {
                guard let id    = item["id"]    as? String, selectedIds.contains(id),
                      let type  = item["type"]  as? String,
                      let index = item["index"] as? Int else { continue }

                switch type {
                case "application" where index < appArray.count:
                    appTokens.insert(appArray[index])
                case "category" where index < catArray.count:
                    categoryTokens.insert(catArray[index])
                case "webDomain" where index < webArray.count:
                    webTokens.insert(webArray[index])
                default: break
                }
            }

            self.store.shield.applications = appTokens.isEmpty ? nil : appTokens
            self.store.shield.applicationCategories = categoryTokens.isEmpty
                ? nil
                : .specific(categoryTokens, except: Set())
            self.store.shield.webDomains = webTokens.isEmpty ? nil : webTokens

            promise.resolve(nil)
        }

        // Async: shields every item in the current selection
        AsyncFunction("blockAll") { (promise: Promise) in
            self.loadSelection()

            if !self.currentSelection.applicationTokens.isEmpty {
                self.store.shield.applications = self.currentSelection.applicationTokens
            }
            if !self.currentSelection.categoryTokens.isEmpty {
                self.store.shield.applicationCategories =
                    .specific(self.currentSelection.categoryTokens, except: Set())
            }
            if !self.currentSelection.webDomainTokens.isEmpty {
                self.store.shield.webDomains = self.currentSelection.webDomainTokens
            }

            promise.resolve(nil)
        }

        // Async: removes all shields from ManagedSettingsStore
        AsyncFunction("clearBlocking") { (promise: Promise) in
            if #available(iOS 16.0, *) {
                self.store.clearAllSettings()
            }
            promise.resolve(nil)
        }

        // Async: clears persisted selection AND removes all shields
        AsyncFunction("clearSelection") { (promise: Promise) in
            self.currentSelection = FamilyActivitySelection()
            self.saveSelection()
            if #available(iOS 16.0, *) {
                self.store.clearAllSettings()
            }
            promise.resolve(nil)
        }

        // Async: registers OS-level monitoring (DeviceActivityCenter) for every
        // enabled plan, so the TimedBlockMonitor extension can start/end the
        // shield even when this app isn't running. Replaces any previously
        // registered schedule wholesale — callers pass the full current plan
        // list every time (add/edit/remove/toggle all funnel through here).
        AsyncFunction("scheduleTimedBlocks") { (plans: [[String: Any]], promise: Promise) in
            guard #available(iOS 16.0, *) else {
                promise.reject("UNAVAILABLE", "Screen Time API requires iOS 16.0+")
                return
            }

            if plans.isEmpty {
                promise.resolve(nil)
                return
            }

            let center = DeviceActivityCenter()
            center.stopMonitoring(center.activities)

            var stored: [StoredPlan] = []
            for raw in plans {
                guard
                    let id = raw["id"] as? String,
                    let label = raw["label"] as? String,
                    let daysOfWeek = raw["daysOfWeek"] as? [Int],
                    let appIds = raw["appIds"] as? [String],
                    let startHour = raw["startHour"] as? Int,
                    let startMinute = raw["startMinute"] as? Int,
                    let endHour = raw["endHour"] as? Int,
                    let endMinute = raw["endMinute"] as? Int,
                    !daysOfWeek.isEmpty
                else { continue }

                stored.append(StoredPlan(id: id, label: label, daysOfWeek: daysOfWeek, appIds: appIds))

                let schedule = DeviceActivitySchedule(
                    intervalStart: DateComponents(hour: startHour, minute: startMinute),
                    intervalEnd: DateComponents(hour: endHour, minute: endMinute),
                    repeats: true
                )
                // DeviceActivitySchedule has no day-of-week filter, so every plan
                // is registered daily — the extension checks daysOfWeek itself
                // before applying the shield.
                try? center.startMonitoring(DeviceActivityName(id), during: schedule)
            }

            if let data = try? JSONEncoder().encode(stored) {
                SharedBlockState.defaults.set(data, forKey: SharedBlockState.planMetadataKey)
                SharedBlockState.defaults.synchronize()
            }
            promise.resolve(nil)
        }

        // Async: unregisters all OS-level monitoring.
        AsyncFunction("clearScheduledBlocks") { (promise: Promise) in
            if #available(iOS 16.0, *) {
                let center = DeviceActivityCenter()
                center.stopMonitoring(center.activities)
            }
            SharedBlockState.defaults.removeObject(forKey: SharedBlockState.planMetadataKey)
            SharedBlockState.defaults.synchronize()
            promise.resolve(nil)
        }

        // Async: returns the plan (if any) the TimedBlockMonitor extension
        // started while this app wasn't running, so JS can reconcile
        // FocusSessionContext after a cold launch. Resolves nil if none.
        AsyncFunction("getActiveNativeBlock") { (promise: Promise) in
            let defaults = SharedBlockState.defaults
            guard let planId = defaults.string(forKey: SharedBlockState.activePlanIdKey) else {
                promise.resolve(nil)
                return
            }
            promise.resolve([
                "planId": planId,
                "startedAt": defaults.double(forKey: SharedBlockState.activeStartedAtKey),
                "label": defaults.string(forKey: SharedBlockState.activeLabelKey) ?? "",
            ])
        }

        // Async: clears the active native block state written by the extension,
        // so stale shared state doesn't cause phantom re-adoption on next app open.
        AsyncFunction("clearActiveNativeBlock") { (promise: Promise) in
            let defaults = SharedBlockState.defaults
            defaults.removeObject(forKey: SharedBlockState.activePlanIdKey)
            defaults.removeObject(forKey: SharedBlockState.activeStartedAtKey)
            defaults.removeObject(forKey: SharedBlockState.activeLabelKey)
            defaults.synchronize()
            promise.resolve(nil)
        }
    }

    // MARK: - Persistence (App Group UserDefaults with PropertyList encoding)
    //
    // Shared via SharedBlockState.appGroupId so the TimedBlockMonitor
    // extension can read the same selection when it applies a shield.

    private func saveSelection() {
        guard let data = try? PropertyListEncoder().encode(currentSelection) else { return }
        SharedBlockState.defaults.set(data, forKey: SharedBlockState.selectionKey)
        SharedBlockState.defaults.synchronize()
    }

    private func loadSelection() {
        guard let data = SharedBlockState.defaults.data(forKey: SharedBlockState.selectionKey),
              let saved = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
        else { return }
        currentSelection = saved
    }

    // MARK: - Token → JS serialization
    //
    // Tokens are opaque; Apple provides no public API to extract a display name
    // outside of SwiftUI's Label(_, token:). We assign stable-ish per-session
    // indices. The native picker already showed the real app names when the user
    // made their selection, so the generic labels here are acceptable for a PoC.

    private func serializeSelection() -> [[String: Any]] {
        var items: [[String: Any]] = []

        for (i, _) in currentSelection.applicationTokens.enumerated() {
            items.append(["id": "app_\(i)", "type": "application",
                          "label": "App \(i + 1)", "index": i])
        }
        for (i, _) in currentSelection.categoryTokens.enumerated() {
            items.append(["id": "cat_\(i)", "type": "category",
                          "label": "Category \(i + 1)", "index": i])
        }
        for (i, _) in currentSelection.webDomainTokens.enumerated() {
            items.append(["id": "web_\(i)", "type": "webDomain",
                          "label": "Web Domain \(i + 1)", "index": i])
        }

        return items
    }
}
