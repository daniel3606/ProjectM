import SwiftUI

// Everything the report views need that isn't screen-time data.
//
// A report extension is handed a context name and nothing else, so anything
// the app wants it to know has to travel through the App Group. Reading from
// there is allowed; it is carrying the *results* back the other way that iOS
// prevents, which is why only the window boundary crosses here.

enum ReportWindow {
    /// Start of the window the app is showing. Everything in the filter before
    /// this belongs to the comparison window behind it.
    ///
    /// Falls back to the start of today, which is what the app asks for most of
    /// the time and keeps the split sane if the value was never written.
    static var boundary: Date {
        SharedBlockState.defaults.synchronize()
        let seconds = SharedBlockState.defaults.double(forKey: SharedBlockState.usageReportBoundaryKey)
        guard seconds > 0 else { return Calendar.current.startOfDay(for: Date()) }
        return Date(timeIntervalSince1970: seconds)
    }
}

/// The app's palette, mirrored from constants/colors.ts. Duplicated rather
/// than shared because an extension compiles on its own — the same reason
/// MarshmallowWidget carries its own copy.
enum ReportPalette {
    static let text = Color(hex: "#1C1C1E")
    static let textSecondary = Color(hex: "#999999")
    static let secondary = Color(hex: "#8B635C")
    static let secondaryLight = Color(hex: "#A87D75")
    static let track = Color(hex: "#EFE4D6")
    static let divider = Color(hex: "#E8DCCC")
    static let positive = Color(hex: "#5C8C6E")
    static let attention = Color(hex: "#B5766B")
}

/// Matches the app's type scale closely enough that a figure drawn here sits
/// on the same line as one drawn in React Native beside it. The rounded system
/// face stands in for SF Compact Rounded, which the extension does not bundle.
enum ReportFont {
    static func rounded(_ size: CGFloat, _ weight: Font.Weight) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}

extension Color {
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
