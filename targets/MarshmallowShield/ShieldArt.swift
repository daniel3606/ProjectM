import UIKit

// The marshmallow, drawn as a UIImage for ShieldConfiguration's `icon`.
//
// Ported from components/MarshmallowCharacter.tsx, the same way
// MarshmallowWidget.swift ports it to SwiftUI: every number below is that
// component's own React Native layout value against its 200x222 body, and the
// whole drawing is scaled as one unit, so the two can be compared directly if
// the RN design changes.
//
// Core Graphics rather than SwiftUI + ImageRenderer because a shield
// configuration is built synchronously, off the main actor, on a very short
// leash — a UIGraphicsImageRenderer pass has no isolation or availability
// caveats, where ImageRenderer has both.

enum ShieldArt {
    private static let bodyWidth: CGFloat = 200
    private static let bodyHeight: CGFloat = 222
    private static let bodyCornerRadius: CGFloat = 65

    private static let ink = UIColor(hex: "#2C2C2E")

    /// Renders the character on a transparent square `height` points on a side.
    ///
    /// Transparent because the shield's background is not a colour this can
    /// know. `ShieldConfiguration` composites its `backgroundColor` over a
    /// blur of the app underneath, so any colour painted here reads as a
    /// square of the wrong shade laid over the screen.
    ///
    /// Square because iOS aspect-fills the icon into a rounded square: a
    /// portrait canvas loses its flatter top and bottom to the crop, leaving
    /// a body whose corners look far too round.
    ///
    /// - Parameters:
    ///   - colorHex: the body colour the user chose, as stored by the app.
    ///   - items: item slot ("headwear"/"wings"/"face") -> emoji, already
    ///     resolved by the JS side so the item catalogue stays in one place.
    static func marshmallow(
        colorHex: String,
        items: [String: String],
        height: CGFloat
    ) -> UIImage {
        // The component draws headwear above the body and wings past both of
        // its sides, so the content box grows for the items actually equipped
        // rather than always leaving room for the largest possible character.
        let contentWidth: CGFloat = items["wings"] != nil ? 300 : 216
        let bodyInsetTop: CGFloat = items["headwear"] != nil ? 62 : 12
        // 20 below the body clears the ground shadow.
        let contentHeight = bodyInsetTop + bodyHeight + 20

        // The content box is enough to survive the rounded-square crop: a
        // 70pt corner radius on a 200x222 body pulls the outline inside the
        // circle inscribed in this square. Sizing off the body's diagonal
        // would only pad the icon and shrink the character.
        let canvasSide = max(contentWidth, contentHeight)
        let scale = height / canvasSide

        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = false

        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: height, height: height),
            format: format
        )

        let image = renderer.image { context in
            let cg = context.cgContext

            /// Converts one of the component's layout units to canvas points.
            func u(_ value: CGFloat) -> CGFloat { value * scale }

            let originX = (canvasSide - contentWidth) / 2
            let originY = (canvasSide - contentHeight) / 2
            let bodyLeft = originX + (contentWidth - bodyWidth) / 2
            let bodyTop = originY + bodyInsetTop

            let body = CGRect(x: u(bodyLeft), y: u(bodyTop), width: u(bodyWidth), height: u(bodyHeight))
            let bodyCentre = CGPoint(x: body.midX, y: body.midY)

            // groundShadow: 161x38, marginLeft 30, bottom -8, rgba(0,0,0,0.06).
            // With neither left nor right set RN centres the 191-wide margin
            // box in the 200-wide body, so the ellipse starts at 34.5.
            let ground = CGRect(
                x: u(bodyLeft + 34.5),
                y: body.maxY + u(8) - u(38),
                width: u(161),
                height: u(38)
            )
            UIColor.black.withAlphaComponent(0.06).setFill()
            UIBezierPath(ovalIn: ground).fill()

            // body, with the component's shadow: offset (0, 6), radius 14, opacity 0.1
            let bodyPath = UIBezierPath(roundedRect: body, cornerRadius: u(bodyCornerRadius))
            cg.saveGState()
            cg.setShadow(
                offset: CGSize(width: 0, height: u(6)),
                blur: u(14),
                color: UIColor.black.withAlphaComponent(0.1).cgColor
            )
            UIColor(hex: colorHex).setFill()
            bodyPath.fill()
            cg.restoreGState()

            // RN draws borderWidth inside the box, so the stroke's centre
            // line sits half a width in rather than on the body's edge.
            let borderWidth = max(1 / format.scale, u(1))
            let borderPath = UIBezierPath(
                roundedRect: body.insetBy(dx: borderWidth / 2, dy: borderWidth / 2),
                cornerRadius: u(bodyCornerRadius) - borderWidth / 2
            )
            UIColor.black.withAlphaComponent(0.04).setStroke()
            borderPath.lineWidth = borderWidth
            borderPath.stroke()

            // shine: 40x20 pill at top 14 / left 28, white 50%, rotated -20deg
            let shine = CGRect(
                x: u(bodyLeft + 28),
                y: u(bodyTop + 14),
                width: u(40),
                height: u(20)
            )
            cg.saveGState()
            let shineCentre = CGPoint(x: shine.midX, y: shine.midY)
            cg.translateBy(x: shineCentre.x, y: shineCentre.y)
            // The context is y-down, so a negative angle turns anticlockwise
            // on screen, matching the component's rotate: "-20deg".
            cg.rotate(by: -20 * .pi / 180)
            cg.translateBy(x: -shineCentre.x, y: -shineCentre.y)
            UIColor.white.withAlphaComponent(0.5).setFill()
            UIBezierPath(roundedRect: shine, cornerRadius: u(10)).fill()
            cg.restoreGState()

            // Face. The component shifts it 14 left of the body's centre; the
            // eyes are 26 across and sit 40 either side of that.
            let faceCentreX = bodyCentre.x - u(14)
            let eyeCentreY = bodyCentre.y + u(5.5)
            let eyeRadius = u(13)

            for direction in [CGFloat(-1), CGFloat(1)] {
                let eyeCentre = CGPoint(x: faceCentreX + direction * u(40), y: eyeCentreY)
                ink.setFill()
                UIBezierPath(
                    ovalIn: CGRect(
                        x: eyeCentre.x - eyeRadius,
                        y: eyeCentre.y - eyeRadius,
                        width: eyeRadius * 2,
                        height: eyeRadius * 2
                    )
                ).fill()

                // eyeHighlight: an 8-wide dot, top 5 / right 4 inside the eye
                let highlight = CGPoint(x: eyeCentre.x + u(5), y: eyeCentre.y - u(4))
                UIColor.white.setFill()
                UIBezierPath(
                    ovalIn: CGRect(
                        x: highlight.x - u(4),
                        y: highlight.y - u(4),
                        width: u(8),
                        height: u(8)
                    )
                ).fill()
            }

            // mouthSmileLine: a 25x10 "U" with a 2.5 stroke. The shield only
            // ever shows the smiling mouth — the character is pleased to be
            // standing in the way.
            let smileLeft = bodyCentre.x - u(30)
            let smileTop = bodyCentre.y + u(35.5)
            let smile = UIBezierPath()
            smile.move(to: CGPoint(x: smileLeft, y: smileTop))
            // A quadratic curve reaches half its control offset, so twice the
            // height here lands the lowest point exactly on the mouth's bottom.
            smile.addQuadCurve(
                to: CGPoint(x: smileLeft + u(25), y: smileTop),
                controlPoint: CGPoint(x: smileLeft + u(12.5), y: smileTop + u(20))
            )
            smile.lineWidth = u(2.5)
            smile.lineCapStyle = .round
            ink.setStroke()
            smile.stroke()

            // Equipped items. RN and Core Graphics measure text differently, so
            // these follow MarshmallowWidget.swift's offsets, which were placed
            // against the home screen by eye rather than by formula.
            if let wings = items["wings"] {
                draw(
                    emoji: wings,
                    centredAt: CGPoint(x: bodyCentre.x - u(110), y: bodyCentre.y - u(13)),
                    fontSize: u(56),
                    mirrored: true
                )
                draw(
                    emoji: wings,
                    centredAt: CGPoint(x: bodyCentre.x + u(110), y: bodyCentre.y - u(13)),
                    fontSize: u(56)
                )
            }
            if let face = items["face"] {
                draw(
                    emoji: face,
                    centredAt: CGPoint(x: bodyCentre.x + u(46), y: bodyCentre.y - u(3)),
                    fontSize: u(22)
                )
            }
            if let headwear = items["headwear"] {
                draw(
                    emoji: headwear,
                    centredAt: CGPoint(x: bodyCentre.x, y: bodyCentre.y - u(123)),
                    fontSize: u(44)
                )
            }
        }

        return image.withRenderingMode(.alwaysOriginal)
    }

    private static func draw(
        emoji: String,
        centredAt centre: CGPoint,
        fontSize: CGFloat,
        mirrored: Bool = false
    ) {
        let string = NSAttributedString(
            string: emoji,
            attributes: [.font: UIFont.systemFont(ofSize: fontSize)]
        )
        let size = string.size()
        let origin = CGPoint(x: centre.x - size.width / 2, y: centre.y - size.height / 2)

        guard mirrored, let cg = UIGraphicsGetCurrentContext() else {
            string.draw(at: origin)
            return
        }

        cg.saveGState()
        cg.translateBy(x: centre.x, y: centre.y)
        cg.scaleBy(x: -1, y: 1)
        cg.translateBy(x: -centre.x, y: -centre.y)
        string.draw(at: origin)
        cg.restoreGState()
    }
}

extension UIColor {
    /// Parses the "#RRGGBB" strings the app stores, falling back to opaque
    /// black rather than failing — a shield with an odd colour is better than
    /// no shield at all.
    convenience init(hex: String) {
        let trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")
        var value: UInt64 = 0
        Scanner(string: trimmed).scanHexInt64(&value)

        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }
}
