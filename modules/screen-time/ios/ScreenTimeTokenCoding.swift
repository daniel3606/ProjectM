import Foundation
import FamilyControls
import ManagedSettings

// Turns an opaque FamilyControls token into a string JS can hold onto, and
// back again. The token itself is meaningless to JS — it never reveals the app
// — but round-tripping it lets a JS-rendered row say *which* token it wants
// drawn, which is the only thing ScreenTimeTokenLabelView needs.
//
// Tokens are encoded inside a wrapper struct because the plist/JSON encoders
// don't accept a bare top-level fragment.
enum ScreenTimeTokenCoding {
    private struct Box<T: Codable>: Codable {
        let token: T
    }

    static func encode<T: Codable>(_ token: T) -> String? {
        guard let data = try? PropertyListEncoder().encode(Box(token: token)) else { return nil }
        return data.base64EncodedString()
    }

    static func decode<T: Codable>(_ string: String, as type: T.Type) -> T? {
        guard let data = Data(base64Encoded: string),
              let box = try? PropertyListDecoder().decode(Box<T>.self, from: data)
        else { return nil }
        return box.token
    }
}
