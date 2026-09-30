import Foundation

struct EventReminder: Codable, Identifiable, Hashable {
    enum Kind: String, Codable, CaseIterable {
        case sameDay
        case dayBefore
        case twoDaysBefore
        case custom

        var title: String {
            switch self {
            case .sameDay: return "El mismo día"
            case .dayBefore: return "1 día antes"
            case .twoDaysBefore: return "2 días antes"
            case .custom: return "Fecha y hora"
            }
        }

        var body: String {
            switch self {
            case .sameDay: return "Hoy tienes este trabajo."
            case .dayBefore: return "Mañana tienes este trabajo."
            case .twoDaysBefore: return "En 2 días tienes este trabajo."
            case .custom: return "Recordatorio de un trabajo agendado."
            }
        }

        var dayOffset: Int {
            switch self {
            case .sameDay: return 0
            case .dayBefore: return -1
            case .twoDaysBefore: return -2
            case .custom: return 0
            }
        }
    }

    var id: UUID
    var kind: Kind
    var time: String
    var customAt: Date?
    var notifiedAt: Date?

    static let defaultTime = "08:00"

    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    func fireDate(startDate: Date, calendar: Calendar = .current) -> Date? {
        if kind == .custom { return customAt }
        guard let day = calendar.date(byAdding: .day, value: kind.dayOffset, to: calendar.startOfDay(for: startDate)) else {
            return nil
        }
        let parts = time.split(separator: ":")
        let hour = Int(parts.first ?? "8") ?? 8
        let minute = parts.count > 1 ? Int(parts[1]) ?? 0 : 0
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day)
    }
}
