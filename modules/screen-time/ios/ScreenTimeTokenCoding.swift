import Foundation
import FamilyControls
import ManagedSettings

// Turns an opaque FamilyControls token into a string JS can hold, and back.
//
// The string reveals nothing about the app — JS can't read a name or an icon
// out of it. It exists so a JS-rendered row can say *which* token it wants
// drawn, which is all ScreenTimeTokenLabelView needs to draw it.
//
// Tokens are boxed before encoding because the plist encoder rejects a bare
// top-level fragment.
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
