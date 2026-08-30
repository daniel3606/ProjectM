import Foundation
import ManagedSettings
import ManagedSettingsUI
import UIKit

// What a blocked app actually looks like.
//
// iOS asks this extension for a ShieldConfiguration every time someone opens
// something a block covers, and renders it over the app. Left alone it is
// Apple's grey card with an hourglass, which reads as an error. This replaces
// it with the app's own screen: the user's marshmallow, the name of the thing
// they just reached for, and a reason to put the phone down that is about
// what they are growing rather than about what they are forbidden.

enum ShieldPresentation {
    // Mirrors constants/colors.ts.
    private enum Palette {
        static let background = UIColor(hex: "#FFF2E5")
        static let text = UIColor(hex: "#1C1C1E")
        static let secondary = UIColor(hex: "#8B635C")
        static let white = UIColor(hex: "#FFFFFF")
        /// MARSHMALLOW_COLORS[0] ("Strawberry"), the app's own default.
        static let defaultMarshmallowHex = "#FFB5C2"
    }

    /// constants/marshmallow.ts's DEFAULT_NAME, for the window between install
    /// and the first time the app writes the real one.
    private static let defaultMarshmallowName = "Mochi"

    /// Points. The shield lays the icon out well above the title, and this is
    /// as tall as it can be drawn there without being scaled down again.
    private static let iconHeight: CGFloat = 160

    /// How long one encouragement stays on screen before the rotation moves
    /// on. Long enough that a single presentation never changes its mind
    /// mid-render, short enough that a second attempt gets a second thought.
    private static let messageLifetime: TimeInterval = 30

    /// Builds the shield for whatever is being blocked. `subject` is the name
    /// of the app, category or domain the user just tried to open; it is
    /// optional because Apple does not always have one to give.
    static func configuration(subject: String?) -> ShieldConfiguration {
        let defaults = SharedBlockState.defaults
        defaults.synchronize()

        let name = defaults.string(forKey: SharedBlockState.marshmallowNameKey)
            ?? defaultMarshmallowName
        let colorHex = defaults.string(forKey: SharedBlockState.marshmallowColorHexKey)
            ?? Palette.defaultMarshmallowHex
        let items = defaults.dictionary(forKey: SharedBlockState.marshmallowItemsKey)
            as? [String: String] ?? [:]
        let sizeCm = defaults.double(forKey: SharedBlockState.marshmallowSizeCmKey)

        return ShieldConfiguration(
            backgroundBlurStyle: nil,
            backgroundColor: Palette.background,
            icon: ShieldArt.marshmallow(colorHex: colorHex, items: items, height: iconHeight),
            title: ShieldConfiguration.Label(text: title(for: subject), color: Palette.text),
            subtitle: ShieldConfiguration.Label(
                text: subtitle(marshmallowName: name, sizeCm: sizeCm, subject: subject),
                color: Palette.secondary
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Let it grow",
                color: Palette.white
            ),
            primaryButtonBackgroundColor: Palette.secondary
        )
    }

    // MARK: - Copy

    private static func title(for subject: String?) -> String {
        guard let subject, !subject.isEmpty else { return "This one can wait" }
        return "\(subject) can wait"
    }

    /// The block's remaining time, when there is one, then the encouragement.
    /// Knowing how long is left is the difference between being stopped and
    /// being asked to hold on, and it is the single most useful thing this
    /// screen can say.
    private static func subtitle(marshmallowName: String, sizeCm: Double, subject: String?) -> String {
        let message = encouragement(marshmallowName: marshmallowName, sizeCm: sizeCm, subject: subject)
        guard let remaining = remainingBlockTime() else { return message }
        return "\(remaining) left.\n\(message)"
    }

    private static func encouragement(marshmallowName: String, sizeCm: Double, subject: String?) -> String {
        let size = String(format: "%.1f", sizeCm)
        let messages = [
            "\(marshmallowName) grows for every minute you don't spend in here.",
            "\(marshmallowName) is \(size) cm. That happened by closing apps exactly like this one.",
            "Nothing in there has changed since the last time you checked.",
            "You set this block while you were thinking clearly. Trust that version of you.",
            "Walk away now and \(marshmallowName) is bigger by tonight.",
            "The urge passes in about a minute. \(marshmallowName) keeps the minute.",
        ]
        return messages[messageIndex(count: messages.count, subject: subject)]
    }

    /// Rotates the encouragement over time, offset by the thing being blocked
    /// so two apps opened in the same minute don't say the same sentence. The
    /// time is bucketed rather than sampled so that the repeated calls iOS
    /// makes for a single presentation all agree.
    private static func messageIndex(count: Int, subject: String?) -> Int {
        let bucket = Int(Date().timeIntervalSince1970 / messageLifetime)
        // String.hashValue is seeded per process and would shuffle between
        // launches; summing the scalars keeps a given app on its own offset.
        let offset = (subject ?? "").unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return abs(bucket &+ offset) % count
    }

    // MARK: - Active block

    /// Reads the running block out of the App Group and phrases what is left
    /// of it, or nil when nothing is running — an always-on block (an app
    /// blocked outside any session) simply has no countdown to offer.
    private static func remainingBlockTime() -> String? {
        let defaults = SharedBlockState.defaults
        let startedAtMs = defaults.double(forKey: SharedBlockState.activeStartedAtKey)
        let durationMinutes = defaults.integer(forKey: SharedBlockState.activeDurationMinutesKey)
        guard startedAtMs > 0, durationMinutes > 0 else { return nil }

        let endsAt = Date(timeIntervalSince1970: startedAtMs / 1000)
            .addingTimeInterval(Double(durationMinutes) * 60)
        let secondsLeft = endsAt.timeIntervalSinceNow
        guard secondsLeft > 0 else { return nil }

        // Rounded up: "1 minute left" is true for the last sixty seconds, and
        // "0 minutes left" on a shield that is still up is a small lie.
        let minutesLeft = Int(ceil(secondsLeft / 60))
        if minutesLeft < 60 {
            return "\(minutesLeft) \(minutesLeft == 1 ? "minute" : "minutes")"
        }

        let hours = minutesLeft / 60
        let minutes = minutesLeft % 60
        let hoursText = "\(hours) \(hours == 1 ? "hour" : "hours")"
        return minutes == 0 ? hoursText : "\(hoursText) \(minutes) min"
    }
}
