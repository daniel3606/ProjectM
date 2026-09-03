import ExpoModulesCore
import SwiftUI
import FamilyControls
import ManagedSettings

// The selected-apps list and the suggested strip, drawn entirely in SwiftUI.
//
// These have to be native: a FamilyControls token only renders through
// SwiftUI's `Label(_ token:)`, and that view has no size to report back across
// the bridge. Laying a row out in React Native meant asking the hosted label
// how big it was, which it answers unreliably until the system resolves the
// app — so rows landed off their centre line depending on when they scrolled
// into view. Inside SwiftUI there is nothing to ask: the label sits in an
// HStack and the layout resolves with it.
//
// React Native still owns the sheet, the draft state and every decision. These
// views take the items to draw and report taps back. Their height is fixed by
// the caller (rows × rowHeight), so JS can size the container without any
// measurement crossing the boundary.

// The token flavours a selection can hold, resolved from `type` so the SwiftUI
// side can pick the matching `Label` initializer.
@available(iOS 16.0, *)
enum ScreenTimeTokenValue {
    case application(ApplicationToken)
    case category(ActivityCategoryToken)
    case webDomain(WebDomainToken)

    static func from(encoded: String, itemType: String) -> ScreenTimeTokenValue? {
        guard !encoded.isEmpty else { return nil }
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

/// One selectable item, as handed over from JS.
struct TokenItemRecord: Record {
    @Field var id: String = ""
    @Field var type: String = "application"
    @Field var token: String = ""
    /// Suggested strip only: whether it is already in the selection.
    @Field var added: Bool = false
}

@available(iOS 16.0, *)
private struct ResolvedItem: Identifiable {
    let id: String
    let token: ScreenTimeTokenValue?
    let added: Bool

    init(record: TokenItemRecord) {
        self.id = record.id
        self.token = ScreenTimeTokenValue.from(encoded: record.token, itemType: record.type)
        self.added = record.added
    }

    /// Stands in when a token predates token storage, or fails to decode.
    var fallbackSymbol: String { "square.grid.2x2" }
}

// MARK: - Shared glyph

@available(iOS 16.0, *)
private struct TokenGlyph: View {
    enum Kind { case icon, name }

    let item: ResolvedItem
    let kind: Kind

    var body: some View {
        switch (kind, item.token) {
        case (.icon, .application(let token)): Label(token).labelStyle(.iconOnly)
        case (.icon, .category(let token)):    Label(token).labelStyle(.iconOnly)
        case (.icon, .webDomain(let token)):   Label(token).labelStyle(.iconOnly)
        case (.icon, .none):                   Image(systemName: item.fallbackSymbol)

        case (.name, .application(let token)): Label(token).labelStyle(.titleOnly)
        case (.name, .category(let token)):    Label(token).labelStyle(.titleOnly)
        case (.name, .webDomain(let token)):   Label(token).labelStyle(.titleOnly)
        case (.name, .none):                   Text(verbatim: "—")
        }
    }
}

// MARK: - Selection list

@available(iOS 16.0, *)
private struct SelectionListContent: View {
    let items: [ResolvedItem]
    let rowHeight: CGFloat
    let iconSize: CGFloat
    let fontSize: CGFloat
    let dividerInset: CGFloat
    let textColor: Color
    let dividerColor: Color
    let removeBackground: Color
    let removeTint: Color
    let onRemove: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HStack(spacing: 16) {
                    TokenGlyph(item: item, kind: .icon)
                        .frame(width: iconSize, height: iconSize)

                    TokenGlyph(item: item, kind: .name)
                        .font(.system(size: fontSize, weight: .medium))
                        .foregroundColor(textColor)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    Spacer(minLength: 8)

                    Button {
                        onRemove(item.id)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(removeTint)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(removeBackground))
                    }
                    .buttonStyle(.plain)
                }
                // The divider is drawn inside the row rather than between rows,
                // so the list is exactly items × rowHeight tall and JS can size
                // the container without measuring anything.
                .frame(height: rowHeight)
                // Every row carries its own top divider, including the first,
                // so the list owns the whole rhythm and the caller never has to
                // place a matching one above it.
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(dividerColor)
                        .frame(height: 1 / UIScreen.main.scale)
                        .padding(.leading, dividerInset)
                }
            }
        }
        // Width fills the host; height is the rows themselves. maxHeight:
        // .infinity made the host grow inside the sheet's scroll view and
        // left empty space after the last row.
        .frame(maxWidth: .infinity, alignment: .top)
        // iOS renders these labels redacted in some hosting contexts, which
        // shows the name as a blur. Clearing the redaction shows the real name.
        .unredacted()
        .environment(\.redactionReasons, [])
        .privacySensitive(false)
    }
}

// MARK: - Suggested strip

@available(iOS 16.0, *)
private struct SuggestedListContent: View {
    let items: [ResolvedItem]
    let iconSize: CGFloat
    let onToggle: (String) -> Void

    private var iconShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                ForEach(items) { item in
                    Button {
                        onToggle(item.id)
                    } label: {
                        ZStack {
                            TokenGlyph(item: item, kind: .icon)
                                .frame(width: iconSize, height: iconSize)
                            iconShape
                                .fill(Color.black.opacity(0.38))
                                .frame(width: iconSize, height: iconSize)
                            Image(systemName: "plus")
                                .font(.system(size: iconSize * 0.36, weight: .semibold))
                                .foregroundColor(.white)
                        }
                        .frame(width: iconSize, height: iconSize)
                        .clipShape(iconShape)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .unredacted()
        .environment(\.redactionReasons, [])
        .privacySensitive(false)
    }
}

// MARK: - Hosts

/// Base host: pins a SwiftUI view to the frame React Native gives it.
class ScreenTimeHostingView: ExpoView {
    var hostingController: UIViewController?

    func host<Content: View>(_ content: Content) {
        detach()

        let hosting = UIHostingController(rootView: content)
        hosting.view.backgroundColor = .clear
        hosting.view.clipsToBounds = true
        if #available(iOS 16.4, *) {
            hosting.safeAreaRegions = []
        }
        addSubview(hosting.view)

        if let parent = parentViewController {
            parent.addChild(hosting)
            hosting.didMove(toParent: parent)
        }
        hostingController = hosting
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Props arrive before React Native lays this view out, so the frame is
        // only ever set here, against real bounds.
        if let view = hostingController?.view, view.frame != bounds {
            view.frame = bounds
        }
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if let hosting = hostingController, hosting.parent == nil, let parent = parentViewController {
            parent.addChild(hosting)
            hosting.didMove(toParent: parent)
        }
    }

    override func removeFromSuperview() {
        detach()
        super.removeFromSuperview()
    }

    func detach() {
        guard let hosting = hostingController else { return }
        hosting.willMove(toParent: nil)
        hosting.view.removeFromSuperview()
        hosting.removeFromParent()
        hostingController = nil
    }

    var parentViewController: UIViewController? {
        var responder: UIResponder? = next
        while let current = responder {
            if let controller = current as? UIViewController { return controller }
            responder = current.next
        }
        return nil
    }
}

final class ScreenTimeSelectionListView: ScreenTimeHostingView {
    let onRemove = EventDispatcher()

    var items: [TokenItemRecord] = []
    var rowHeight: CGFloat = 64
    var iconSize: CGFloat = 40
    var fontSize: CGFloat = 17
    var dividerInset: CGFloat = 56
    var textColor: UIColor = .label
    var dividerColor: UIColor = .separator
    var removeBackground: UIColor = .secondarySystemFill
    var removeTint: UIColor = .secondaryLabel

    func rebuild() {
        guard #available(iOS 16.0, *) else { return }

        host(
            SelectionListContent(
                items: items.map(ResolvedItem.init),
                rowHeight: rowHeight,
                iconSize: iconSize,
                fontSize: fontSize,
                dividerInset: dividerInset,
                textColor: Color(textColor),
                dividerColor: Color(dividerColor),
                removeBackground: Color(removeBackground),
                removeTint: Color(removeTint),
                onRemove: { [weak self] id in
                    self?.onRemove(["id": id])
                }
            )
        )
        invalidateIntrinsicContentSize()
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: CGFloat(items.count) * rowHeight)
    }
}

final class ScreenTimeSuggestedListView: ScreenTimeHostingView {
    let onToggle = EventDispatcher()

    var items: [TokenItemRecord] = []
    var iconSize: CGFloat = 52

    func rebuild() {
        guard #available(iOS 16.0, *) else { return }

        host(
            SuggestedListContent(
                items: items.map(ResolvedItem.init),
                iconSize: iconSize,
                onToggle: { [weak self] id in
                    self?.onToggle(["id": id])
                }
            )
        )
    }
}
