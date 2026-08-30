import ManagedSettings

// The buttons on the shield. Without this extension iOS still draws whatever
// MarshmallowShield asks for, but nothing happens when either button is
// pressed — a shield whose only button does nothing reads as a broken screen.
//
// There is one button, "Let it grow", and it does the one thing the screen is
// asking for: leaves the app.
class ShieldActionExtension: ShieldActionDelegate {
    override func handle(
        action: ShieldAction,
        for application: ApplicationToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        completionHandler(response(to: action))
    }

    override func handle(
        action: ShieldAction,
        for webDomain: WebDomainToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        completionHandler(response(to: action))
    }

    override func handle(
        action: ShieldAction,
        for category: ActivityCategoryToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        completionHandler(response(to: action))
    }

    private func response(to action: ShieldAction) -> ShieldActionResponse {
        switch action {
        case .primaryButtonPressed:
            return .close
        // The shield offers no secondary button, but iOS can still deliver the
        // action; keeping the shield up is the safe answer to a press we did
        // not ask for.
        case .secondaryButtonPressed:
            return .defer
        @unknown default:
            return .none
        }
    }
}
