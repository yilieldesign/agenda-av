import SwiftUI
import UIKit

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let a, r, g, b: UInt64
        switch cleaned.count {
        case 3:
            (a, r, g, b) = (255, (value >> 8) * 17, (value >> 4 & 0xF) * 17, (value & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, value >> 16, value >> 8 & 0xFF, value & 0xFF)
        case 8:
            (a, r, g, b) = (value >> 24, value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        default:
            (a, r, g, b) = (255, 15, 118, 110)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    func toHex() -> String {
        let resolved = resolve(in: EnvironmentValues())
        return String(
            format: "#%02lX%02lX%02lX",
            lround(Double(resolved.red) * 255),
            lround(Double(resolved.green) * 255),
            lround(Double(resolved.blue) * 255)
        )
    }
}

extension UIColor {
    convenience init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let a, r, g, b: UInt64
        switch cleaned.count {
        case 3:
            (a, r, g, b) = (255, (value >> 8) * 17, (value >> 4 & 0xF) * 17, (value & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, value >> 16, value >> 8 & 0xFF, value & 0xFF)
        case 8:
            (a, r, g, b) = (value >> 24, value >> 16 & 0xFF, value >> 8 & 0xFF, value & 0xFF)
        default:
            (a, r, g, b) = (255, 15, 118, 110)
        }

        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}

extension Company {
    var color: Color {
        Color(hex: colorHex)
    }
}

enum CompanyColorPalette {
    static let hexes = [
        "#0F766E",
        "#C2410C",
        "#3730A3",
        "#BE185D",
        "#0369A1",
        "#A16207",
        "#7C3AED",
        "#B91C1C",
        "#0E7490",
        "#4D7C0F"
    ]

    static func nextUnused(from used: [String]) -> String {
        let normalizedUsed = Set(used.map { $0.uppercased() })
        return hexes.first { !normalizedUsed.contains($0.uppercased()) } ?? hexes[used.count % hexes.count]
    }
}
