import Foundation

enum PaymentStatus: String, Codable, CaseIterable, Identifiable {
    case pending
    case paid

    var id: String { rawValue }

    var title: String {
        switch self {
        case .pending: "Pendiente"
        case .paid: "Pagado"
        }
    }

    var systemImage: String {
        switch self {
        case .pending: "clock.badge.exclamationmark"
        case .paid: "checkmark.circle.fill"
        }
    }
}
