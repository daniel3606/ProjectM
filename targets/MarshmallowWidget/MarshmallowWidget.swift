import WidgetKit
import SwiftUI

// Home-screen widget (systemSmall / 2x2) showing the marshmallow's current
// size, its appearance, and — while a Quick or Timed Block is running — a live
// countdown to when it ends. All of it is read from the same App Group
// SharedBlockState the main app and TimedBlockMonitor extension already
// write to; this extension never runs Screen Time APIs itself.

struct ActiveBlockInfo {
    let startedAt: Date
    let endsAt: Date
    /// Growth this block pays out on completion, previewed as "(+x.x)" next
    /// to the current size. The app only awards it once the block finishes.
    let growthCm: Double
}

struct MarshmallowEntry: TimelineEntry {
    let date: Date
    let sizeCm: Double
    let colorHex: String
    /// Item slot ("headwear"/"wings"/"face") -> emoji, resolved by the JS side.
    let items: [String: String]
    let activeBlock: ActiveBlockInfo?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> MarshmallowEntry {
        MarshmallowEntry(
            date: Date(),
            sizeCm: 12.5,
            colorHex: Palette.defaultMarshmallowHex,
            items: [:],
            activeBlock: nil
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (MarshmallowEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MarshmallowEntry>) -> Void) {
        let entry = loadEntry()

        // While a block is active, the next meaningful state change is the
        // moment it ends — Text(timerInterval:) handles the live countdown
        // in between without further reloads. Otherwise fall back to a
        // periodic refresh; WidgetCenter.reloadAllTimelines() calls from the
        // app/extension handle prompt updates whenever state actually changes.
        let reloadAt = entry.activeBlock?.endsAt ?? Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [entry], policy: .after(reloadAt)))
    }

    private func loadEntry() -> MarshmallowEntry {
        let defaults = SharedBlockState.defaults

        let sizeCm = defaults.object(forKey: SharedBlockState.marshmallowSizeCmKey) != nil
            ? defaults.double(forKey: SharedBlockState.marshmallowSizeCmKey)
            : Character.initialSizeCm
        let colorHex = defaults.string(forKey: SharedBlockState.marshmallowColorHexKey)
            ?? Palette.defaultMarshmallowHex
        let items = defaults.dictionary(forKey: SharedBlockState.marshmallowItemsKey)
            as? [String: String] ?? [:]

        // A block counts as running only while it still has time left — the
        // app clears these keys when one ends, but the widget can also be
        // asked to render before that happens.
        var activeBlock: ActiveBlockInfo?
        let startedAtMs = defaults.double(forKey: SharedBlockState.activeStartedAtKey)
        let durationMinutes = defaults.integer(forKey: SharedBlockState.activeDurationMinutesKey)
        if startedAtMs > 0, durationMinutes > 0 {
            let startedAt = Date(timeIntervalSince1970: startedAtMs / 1000)
            let endsAt = startedAt.addingTimeInterval(Double(durationMinutes) * 60)
            if endsAt > Date() {
                activeBlock = ActiveBlockInfo(
                    startedAt: startedAt,
                    endsAt: endsAt,
                    growthCm: defaults.double(forKey: SharedBlockState.activeGrowthCmKey)
                )
            }
        }

        return MarshmallowEntry(
            date: Date(),
            sizeCm: sizeCm,
            colorHex: colorHex,
            items: items,
            activeBlock: activeBlock
        )
    }
}

// MARK: - Palette
//
// Mirrors constants/colors.ts and constants/marshmallow.ts.

private enum Palette {
    static let background = Color(hex: "#FFF2E5")
    static let text = Color(hex: "#1C1C1E")
    static let textSecondary = Color(hex: "#999999")
    static let secondary = Color(hex: "#8B635C")
    /// Colors.success, used for the pending growth a running block will pay out.
    static let growth = Color(hex: "#34C759")
    /// MARSHMALLOW_COLORS[0] ("Strawberry"), the app's own default.
    static let defaultMarshmallowHex = "#FFB5C2"
}

// MARK: - Marshmallow character
//
// Ported from components/MarshmallowCharacter.tsx so the widget shows the same
// character as the home screen. Every value below is that component's React
// Native layout value against its 200x222 body, and the whole drawing is
// scaled as one unit — so the two can be compared directly if the RN design
// changes. Positions are expressed as offsets from the body's centre, since
// SwiftUI has no equivalent of RN's flexbox + absolute positioning.

private enum Character {
    static let initialSizeCm = 2.5

    static let bodyWidth: CGFloat = 200
    static let bodyHeight: CGFloat = 222
    static let bodyCornerRadius: CGFloat = 70

    static let ink = Color(hex: "#2C2C2E")

    // Shine: top 14, left 28, 40x20, radius 10, rotated -20deg.
    static let shineSize = CGSize(width: 40, height: 20)
    static let shineOffset = CGSize(width: -52, height: -87)

    // Eyes: 26x26, 54 apart, sitting just below the body's centre.
    static let eyeDiameter: CGFloat = 26
    static let eyeCentreY: CGFloat = 5.5
    static let eyeCentreX: CGFloat = 40
    /// The face is shifted left by half of faceShift's 28pt right margin.
    static let faceShiftX: CGFloat = -14

    // Eye highlight: 8x8, top 5 / right 4 within the eye.
    static let eyeHighlightDiameter: CGFloat = 8
    static let eyeHighlightOffset = CGSize(width: 5, height: -4)

    // Smile: 25x10 with a 2.5 stroke; the determined mouth is a 26x3 bar.
    static let smileSize = CGSize(width: 25, height: 10)
    static let smileOffset = CGSize(width: -17.5, height: 40.5)
    static let mouthStroke: CGFloat = 2.5
    static let determinedSize = CGSize(width: 26, height: 3)
    static let determinedOffset = CGSize(width: -14, height: 34)

    // Ground shadow: 161x38 ellipse, 8 below the body, nudged right.
    static let groundShadowSize = CGSize(width: 161, height: 38)
    static let groundShadowOffset = CGSize(width: 15, height: 100)

    // Equipped item emoji. RN and SwiftUI measure text differently, so these
    // are positioned to match the home screen by eye rather than by formula.
    static let headwearFontSize: CGFloat = 44
    static let headwearOffset = CGSize(width: 0, height: -123)
    static let wingsFontSize: CGFloat = 56
    static let wingsOffset = CGSize(width: 110, height: -13)
    static let faceItemFontSize: CGFloat = 22
    static let faceItemOffset = CGSize(width: 46, height: -3)
}

/// The smile's "U": a 25x10 arc, standing in for the RN version's bottom-only
/// border with large bottom corner radii.
private struct SmileShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY),
            // A quadratic curve reaches half its control offset, so twice the
            // height here lands the lowest point exactly on the rect's bottom.
            control: CGPoint(x: rect.midX, y: rect.minY + rect.height * 2)
        )
        return path
    }
}

private struct MarshmallowCharacterView: View {
    let colorHex: String
    let items: [String: String]
    /// Smiles while apps are blocked; a flat determined mouth otherwise.
    let isBlocking: Bool
    /// Drawn height in points; the whole character scales to match.
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

// MARK: - Widget

struct MarshmallowWidgetEntryView: View {
    var entry: Provider.Entry

    private var isBlocking: Bool { entry.activeBlock != nil }

    // While a block runs the countdown is the headline and there's an extra
    // row competing for the widget's height, so the size readout steps down
    // to make room for it.
    private var sizeNumberFontSize: CGFloat { isBlocking ? 22 : 36 }
    private var sizeUnitFontSize: CGFloat { isBlocking ? 11 : 16 }

    var body: some View {
        VStack(spacing: 4) {
            MarshmallowCharacterView(
                colorHex: entry.colorHex,
                items: entry.items,
                isBlocking: entry.activeBlock != nil,
                height: 74
            )
            // Headwear and wings are drawn outside the body's frame, so leave
            // room for them rather than letting them run into the edge.
            .padding(.top, 10)

            sizeRow

            if let active = entry.activeBlock {
                Text(timerInterval: active.startedAt...active.endsAt, countsDown: true)
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .foregroundColor(Palette.secondary)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetBackground(Palette.background)
    }

    /// Mirrors GrowthScene's SizeIndicator: bold number, smaller secondary
    /// unit, aligned on their baselines. While a block is running the growth
    /// it will pay out sits between the two, e.g. "12.5 (+1.2) cm".
    private var sizeRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 2) {
            Text(String(format: "%.1f", entry.sizeCm))
                .font(.system(size: sizeNumberFontSize, weight: .bold, design: .rounded))
                .foregroundColor(Palette.text)

            if let growthCm = entry.activeBlock?.growthCm, growthCm > 0 {
                Text(String(format: "(+%.1f)", growthCm))
                    .font(.system(size: sizeUnitFontSize, weight: .bold, design: .rounded))
                    .foregroundColor(Palette.growth)
            }

            Text("cm")
                .font(.system(size: sizeUnitFontSize, weight: .semibold, design: .rounded))
                .foregroundColor(Palette.textSecondary)
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}

struct MarshmallowWidget: Widget {
    let kind: String = "MarshmallowWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MarshmallowWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Marshmallow")
        .description("Your marshmallow's size, and any active block's remaining time.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct MarshmallowWidgetBundle: WidgetBundle {
    var body: some Widget {
        MarshmallowWidget()
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

private extension View {
    // containerBackground(for:) is required on iOS 17+ for widgets to render
    // correctly in the gallery/on-device; falls back to a plain background
    // below that, matching this project's iOS 16 deployment target.
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            background(color)
        }
    }
}
