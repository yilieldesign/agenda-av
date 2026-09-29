import Foundation

enum ReportKind: String, CaseIterable, Identifiable {
    case biweekly
    case monthly
    case yearly
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .biweekly: "Quincenal"
        case .monthly: "Mensual"
        case .yearly: "Anual"
        case .custom: "Del… al…"
        }
    }
}

enum BiweeklyMode: String, CaseIterable, Identifiable {
    case firstHalf
    case secondHalf
    case rolling15

    var id: String { rawValue }

    var title: String {
        switch self {
        case .firstHalf: "1 al 15"
        case .secondHalf: "16 al fin de mes"
        case .rolling15: "15 días desde una fecha"
        }
    }
}

struct ReportPeriod: Equatable {
    var kind: ReportKind = .monthly
    var monthAnchor: Date = .now
    var biweeklyMode: BiweeklyMode = .firstHalf
    var customStart: Date = Calendar.current.startOfDay(for: .now)
    var customEnd: Date = Calendar.current.startOfDay(for: .now)

    /// Inicio y fin inclusivos, normalizados a inicio de día.
    var closedRange: ClosedRange<Date> {
        let calendar = Calendar.current
        switch kind {
        case .monthly:
            let start = calendar.startOfMonth(for: monthAnchor)
            let end = calendar.startOfDay(for: calendar.endOfMonth(for: monthAnchor))
            return start ... end
        case .yearly:
            let start = calendar.startOfDay(for: calendar.startOfYear(for: monthAnchor))
            let end = calendar.startOfDay(for: calendar.endOfYear(for: monthAnchor))
            return start ... end
        case .biweekly:
            switch biweeklyMode {
            case .firstHalf:
                let start = calendar.startOfMonth(for: monthAnchor)
                let end = calendar.date(byAdding: .day, value: 14, to: start) ?? start
                return start ... calendar.startOfDay(for: end)
            case .secondHalf:
                let start = calendar.date(
                    byAdding: .day,
                    value: 15,
                    to: calendar.startOfMonth(for: monthAnchor)
                ) ?? monthAnchor
                let end = calendar.startOfDay(for: calendar.endOfMonth(for: monthAnchor))
                return calendar.startOfDay(for: start) ... end
            case .rolling15:
                let start = calendar.startOfDay(for: customStart)
                let end = calendar.date(byAdding: .day, value: 14, to: start) ?? start
                return start ... calendar.startOfDay(for: end)
            }
        case .custom:
            let start = calendar.startOfDay(for: min(customStart, customEnd))
            let end = calendar.startOfDay(for: max(customStart, customEnd))
            return start ... end
        }
    }

    var title: String {
        let range = closedRange
        let startText = range.lowerBound.formatted(.dateTime.day().month(.wide).year())
        let endText = range.upperBound.formatted(.dateTime.day().month(.wide).year())
        return "\(startText) – \(endText)"
    }
}
