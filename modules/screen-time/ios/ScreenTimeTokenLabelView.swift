import ExpoModulesCore
import SwiftUI
import FamilyControls
import ManagedSettings

// Draws the real name and/or icon behind one Screen Time token.
//
// FamilyControls tokens are deliberately opaque: there is no API that hands
// the app an app's display name or icon as data, so nothing useful can be sent
// over the bridge for JS to render (which is why the selection's `label` is
// only ever a generic "App 1" fallback). The one supported way to show either
// is SwiftUI's `Label(_ token:)`, which resolves both inside a system-owned
// view. This hosts that view and reports the size it wants back to Yoga, so a
// React Native chip laid out around it hugs the real label.

enum TokenLabelMode: String, Enumerable {
    case icon
    case name
    case both
}

// The three token flavours a selection can hold, resolved from the `itemType`
// prop so the SwiftUI side can pick the matching `Label` initializer.
@available(iOS 16.0, *)
enum ScreenTimeTokenValue {
    case application(ApplicationToken)
    case category(ActivityCategoryToken)
    case webDomain(WebDomainToken)

    static func from(encoded: String, itemType: String) -> ScreenTimeTokenValue? {
        switch itemType {
        case "application":
            return ScreenTimeTokenCoding.decode(encoded, as: ApplicationToken.self).map(Self.application)
        case "category":
            return ScreenTimeTokenCoding.decode(encoded, as: ActivityCategoryToken.self).map(Self.category)
        case "webDomain":
            return ScreenTimeTokenCoding.decode(encoded, as: WebDomainToken.self).map(Self.webDomain)
        default:
            return nil
        }
    }
}

@available(iOS 16.0, *)
private struct ScreenTimeTokenLabelContent: View {
    let token: ScreenTimeTokenValue
    let mode: TokenLabelMode
    let fontSize: CGFloat
    let color: Color

    @ViewBuilder private var label: some View {
        switch token {
        case .application(let token): Label(token)
        case .category(let token):    Label(token)
        case .webDomain(let token):   Label(token)
        }
    }

    var body: some View {
        Group {
            switch mode {
            case .icon: label.labelStyle(.iconOnly)
            case .name: label.labelStyle(.titleOnly)
            case .both: label.labelStyle(.titleAndIcon)
            }
        }
        // No width limit here on purpose — the view is measured at its ideal
        // width and then clamped to `maxWidth` by the host, and SwiftUI
        // truncates on its own once it is laid out in the narrower frame.
        .font(.system(size: fontSize, weight: .medium))
        .foregroundColor(color)
        .lineLimit(1)
        .truncationMode(.tail)
        .fixedSize(horizontal: false, vertical: true)
        // iOS draws the name redacted (blurred) in some hosting contexts even
        // though the icon comes through clean. If that redaction is driven by
        // the environment these clear it; if it is baked into the system's own
        // rendering, they are simply no-ops.
        .unredacted()
        .environment(\.redactionReasons, [])
        .privacySensitive(false)
    }
}

final class ScreenTimeTokenLabelView: ExpoView {
    var encodedToken: String?
    var itemType: String = "application"
    var mode: TokenLabelMode = .both
    var fontSize: CGFloat = 15
    var textColor: UIColor = .label
    var maxWidth: CGFloat = 240

    private var hostingController: UIViewController?
    private var reportedSize: CGSize = .zero

    // Rebuilds the hosted SwiftUI view for the current props. Called once per
    // prop update batch, from OnViewDidUpdateProps.
    func rebuild() {
        detachHostingController()

        guard #available(iOS 16.0, *),
              let encoded = encodedToken, !encoded.isEmpty,
              let token = ScreenTimeTokenValue.from(encoded: encoded, itemType: itemType)
        else { return }

        let content = ScreenTimeTokenLabelContent(
            token: token,
            mode: mode,
            fontSize: fontSize,
            color: Color(textColor)
        )

        let hosting = UIHostingController(rootView: content)
        hosting.view.backgroundColor = .clear
        hosting.view.frame = bounds
        hosting.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(hosting.view)

        if let parent = parentViewController {
            parent.addChild(hosting)
            hosting.didMove(toParent: parent)
        }
        hostingController = hosting

        scheduleMeasurements()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()

        // The view can be created before it has a parent controller, so adopt
        // one as soon as it lands in a window.
        if let hosting = hostingController, hosting.parent == nil, let parent = parentViewController {
            parent.addChild(hosting)
            hosting.didMove(toParent: parent)
        }
        if window != nil {
            scheduleMeasurements()
        }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        measureAndReport()
    }

    override func removeFromSuperview() {
        detachHostingController()
        super.removeFromSuperview()
    }

    private func detachHostingController() {
        guard let hosting = hostingController else { return }
        hosting.willMove(toParent: nil)
        hosting.view.removeFromSuperview()
        hosting.removeFromParent()
        hostingController = nil
    }

    // The system fills the name and icon in asynchronously, so the label's
    // ideal size can grow a beat after it is mounted. Re-measure a few times
    // to catch that; each pass is a no-op once the size stops changing.
    private func scheduleMeasurements() {
        for delay in [0.0, 0.15, 0.4, 1.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.measureAndReport()
            }
        }
    }

    private func measureAndReport() {
        guard let hostingView = hostingController?.view else { return }

        let unbounded = CGSize(width: 10_000, height: 10_000)
        var size = hostingView.sizeThatFits(unbounded)
        size.width = ceil(min(size.width, maxWidth))
        size.height = ceil(size.height)

        guard size.width > 0, size.height > 0 else { return }
        guard abs(size.width - reportedSize.width) > 0.5
                || abs(size.height - reportedSize.height) > 0.5 else { return }

        reportedSize = size
        // Hands the measured size to Yoga so the view sizes itself in RN,
        // the way an image with an intrinsic size would.
        setViewSize(size)
    }

    private var parentViewController: UIViewController? {
        var responder: UIResponder? = next
        while let current = responder {
            if let controller = current as? UIViewController { return controller }
            responder = current.next
        }
        return nil
    }
}
