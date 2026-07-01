import ExpoModulesCore
import SwiftUI
import FamilyControls
import ManagedSettings

public class ScreenTimeModule: Module {
    private let store = ManagedSettingsStore()
    private var currentSelection = FamilyActivitySelection()
    private let persistenceKey = "marshmallow_screen_time_selection"

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
            self.store.clearAllSettings()
            promise.resolve(nil)
        }

        // Async: clears persisted selection AND removes all shields
        AsyncFunction("clearSelection") { (promise: Promise) in
            self.currentSelection = FamilyActivitySelection()
            self.saveSelection()
            self.store.clearAllSettings()
            promise.resolve(nil)
        }
    }

    // MARK: - Persistence (UserDefaults with PropertyList encoding)

    private func saveSelection() {
        guard let data = try? PropertyListEncoder().encode(currentSelection) else { return }
        UserDefaults.standard.set(data, forKey: persistenceKey)
    }

    private func loadSelection() {
        guard let data = UserDefaults.standard.data(forKey: persistenceKey),
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
