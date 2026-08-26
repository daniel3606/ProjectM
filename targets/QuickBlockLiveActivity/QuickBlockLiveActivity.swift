import ActivityKit
import SwiftUI
import WidgetKit

// Live Activity for a running block, Quick or Timed — the marshmallow on the
// Lock Screen banner and in the Dynamic Island, alongside a live countdown.

// MARK: - Palette (mirrors constants/colors.ts + MarshmallowWidget)

private enum Palette {
    static let background = Color(hex: "#FFF2E5")
    static let card = Color(hex: "#FFF5EA")
    static let text = Color(hex: "#1C1C1E")
    static let textSecondary = Color(hex: "#999999")
    static let secondary = Color(hex: "#8B635C")
    static let defaultMarshmallowHex = "#FFB5C2"
}

private struct LiveActivityProfile {
    let colorHex: String
    let items: [String: String]

    static func load() -> LiveActivityProfile {
        let defaults = SharedBlockState.defaults
        let colorHex = defaults.string(forKey: SharedBlockState.marshmallowColorHexKey)
            ?? Palette.defaultMarshmallowHex
        let items = defaults.dictionary(forKey: SharedBlockState.marshmallowItemsKey)
            as? [String: String] ?? [:]
        return LiveActivityProfile(colorHex: colorHex, items: items)
    }
}

// MARK: - Character layout (ported from MarshmallowWidget / MarshmallowCharacter.tsx)

private enum Character {
    static let bodyWidth: CGFloat = 200
    static let bodyHeight: CGFloat = 222
    static let bodyCornerRadius: CGFloat = 70
    static let ink = Color(hex: "#2C2C2E")

    static let shineSize = CGSize(width: 40, height: 20)
    static let shineOffset = CGSize(width: -52, height: -87)

    static let eyeDiameter: CGFloat = 26
    static let eyeCentreY: CGFloat = 5.5
    static let eyeCentreX: CGFloat = 40
    static let faceShiftX: CGFloat = -14

    static let eyeHighlightDiameter: CGFloat = 8
    static let eyeHighlightOffset = CGSize(width: 5, height: -4)

    static let smileSize = CGSize(width: 25, height: 10)
    static let smileOffset = CGSize(width: -17.5, height: 40.5)
    static let mouthStroke: CGFloat = 2.5
    static let determinedSize = CGSize(width: 26, height: 3)
    static let determinedOffset = CGSize(width: -14, height: 34)

    static let groundShadowSize = CGSize(width: 161, height: 38)
    static let groundShadowOffset = CGSize(width: 15, height: 100)

    static let headwearFontSize: CGFloat = 44
    static let headwearOffset = CGSize(width: 0, height: -123)
    static let wingsFontSize: CGFloat = 56
    static let wingsOffset = CGSize(width: 110, height: -13)
    static let faceItemFontSize: CGFloat = 22
    static let faceItemOffset = CGSize(width: 46, height: -3)
}

private struct SmileShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY),
            control: CGPoint(x: rect.midX, y: rect.minY + rect.height * 2)
        )
        return path
    }
}

/// Full-color marshmallow for the Lock Screen Live Activity banner.
private struct MarshmallowCharacterView: View {
    let colorHex: String
    let items: [String: String]
    /// Smiles while apps are blocked; a flat determined mouth otherwise.
    let isBlocking: Bool
    let height: CGFloat

    private var scale: CGFloat { height / Character.bodyHeight }

    var body: some View {
        ZStack {
            Ellipse()
                .fill(Color.black.opacity(0.06))
                .frame(width: Character.groundShadowSize.width, height: Character.groundShadowSize.height)
                .offset(x: Character.groundShadowOffset.width, y: Character.groundShadowOffset.height)

            if let wings = items["wings"] {
                Text(wings)
                    .font(.system(size: Character.wingsFontSize))
                    .scaleEffect(x: -1)
                    .offset(x: -Character.wingsOffset.width, y: Character.wingsOffset.height)
                Text(wings)
                    .font(.system(size: Character.wingsFontSize))
                    .offset(x: Character.wingsOffset.width, y: Character.wingsOffset.height)
            }

            marshmallowBody

            if let headwear = items["headwear"] {
                Text(headwear)
                    .font(.system(size: Character.headwearFontSize))
                    .offset(x: Character.headwearOffset.width, y: Character.headwearOffset.height)
            }
        }
        .frame(width: Character.bodyWidth, height: Character.bodyHeight)
        .scaleEffect(scale)
        .frame(width: Character.bodyWidth * scale, height: height)
    }

    private var marshmallowBody: some View {
        RoundedRectangle(cornerRadius: Character.bodyCornerRadius, style: .circular)
            .fill(Color(hex: colorHex))
            .frame(width: Character.bodyWidth, height: Character.bodyHeight)
            .overlay(
                RoundedRectangle(cornerRadius: Character.bodyCornerRadius, style: .circular)
                    .stroke(Color.black.opacity(0.04), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.1), radius: 14, x: 0, y: 6)
            .overlay(shine)
            .overlay(face)
    }

    private var shine: some View {
        Capsule()
            .fill(Color.white.opacity(0.5))
            .frame(width: Character.shineSize.width, height: Character.shineSize.height)
            .rotationEffect(.degrees(-20))
            .offset(x: Character.shineOffset.width, y: Character.shineOffset.height)
    }

    private var face: some View {
        ZStack {
            eye(centreX: Character.faceShiftX - Character.eyeCentreX)
            eye(centreX: Character.faceShiftX + Character.eyeCentreX)
            mouth

            if let faceItem = items["face"] {
                Text(faceItem)
                    .font(.system(size: Character.faceItemFontSize))
                    .offset(x: Character.faceItemOffset.width, y: Character.faceItemOffset.height)
            }
        }
    }

    private func eye(centreX: CGFloat) -> some View {
        Circle()
            .fill(Character.ink)
            .frame(width: Character.eyeDiameter, height: Character.eyeDiameter)
            .overlay(
                Circle()
                    .fill(Color.white)
                    .frame(
                        width: Character.eyeHighlightDiameter,
                        height: Character.eyeHighlightDiameter
                    )
                    .offset(
                        x: Character.eyeHighlightOffset.width,
                        y: Character.eyeHighlightOffset.height
                    )
            )
            .offset(x: centreX, y: Character.eyeCentreY)
    }

    @ViewBuilder
    private var mouth: some View {
        if isBlocking {
            SmileShape()
                .stroke(
                    Character.ink,
                    style: StrokeStyle(lineWidth: Character.mouthStroke, lineCap: .round)
                )
                .frame(width: Character.smileSize.width, height: Character.smileSize.height)
                .offset(x: Character.smileOffset.width, y: Character.smileOffset.height)
        } else {
            Capsule()
                .fill(Character.ink)
                .frame(width: Character.determinedSize.width, height: Character.determinedSize.height)
                .offset(x: Character.determinedOffset.width, y: Character.determinedOffset.height)
        }
    }
}

// MARK: - Live Activity

private enum CompactIsland {
    /// Text(timerInterval:) otherwise reserves room for the widest form it
    /// could ever render ("59:59:59"), which widens the island far more than
    /// a focus block ever needs.
    static let countdownWidth: CGFloat = 42
}

struct QuickBlockLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BlockAttributes.self) { context in
            lockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    islandCharacter(height: 36)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdownText(
                        startedAt: context.state.startedAt,
                        endsAt: context.state.endsAt,
                        font: .system(size: 22, weight: .bold, design: .rounded)
                    )
                    .foregroundStyle(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.label)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                        Text(focusModeLabel(context.attributes.focusMode))
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.72))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                // The compact regions size the island itself, so both stay
                // deliberately narrow — anything wider starts covering the
                // status bar's clock and the indicators opposite it.
                islandCharacter(height: 15)
            } compactTrailing: {
                countdownText(
                    startedAt: context.state.startedAt,
                    endsAt: context.state.endsAt,
                    font: .system(size: 12, weight: .semibold, design: .rounded)
                )
                .frame(maxWidth: CompactIsland.countdownWidth)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .foregroundStyle(.white)
            } minimal: {
                islandCharacter(height: 15)
            }
        }
    }

    /// The same full-color marshmallow the Lock Screen banner shows, minus
    /// equipped items — headwear and wings are drawn outside the body's frame
    /// and would spill past the island's edges at these sizes.
    private func islandCharacter(height: CGFloat) -> some View {
        MarshmallowCharacterView(
            colorHex: LiveActivityProfile.load().colorHex,
            items: [:],
            isBlocking: true,
            height: height
        )
    }

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<BlockAttributes>) -> some View {
        let profile = LiveActivityProfile.load()

        HStack(spacing: 12) {
            MarshmallowCharacterView(
                colorHex: profile.colorHex,
                items: profile.items,
                isBlocking: true,
                height: 58
            )
            .padding(.top, 6)

            VStack(alignment: .leading, spacing: 2) {
                Text(context.attributes.label)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Palette.text)
                Text(focusModeLabel(context.attributes.focusMode))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.textSecondary)
            }

            Spacer()

            countdownText(
                startedAt: context.state.startedAt,
                endsAt: context.state.endsAt,
                font: .system(size: 20, weight: .bold, design: .rounded)
            )
            .foregroundStyle(Palette.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .activityBackgroundTint(Palette.card)
    }

    private func countdownText(startedAt: Date, endsAt: Date, font: Font) -> some View {
        Text(timerInterval: startedAt...endsAt, countsDown: true)
            .font(font)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }

    private func focusModeLabel(_ mode: String) -> String {
        mode == "deep" ? "Deep Focus" : "Flexible Focus"
    }
}

@main
struct QuickBlockLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        QuickBlockLiveActivity()
    }
}

private extension Color {
    init(hex: String) {
        let hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var rgbValue: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgbValue)

        self.init(
            red: Double((rgbValue >> 16) & 0xFF) / 255,
            green: Double((rgbValue >> 8) & 0xFF) / 255,
            blue: Double(rgbValue & 0xFF) / 255
        )
    }
}
