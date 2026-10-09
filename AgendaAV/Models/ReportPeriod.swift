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

    var paydayMode: BiweeklyMode? {
        guard kind == .biweekly, biweeklyMode != .rolling15 else { return nil }
        return biweeklyMode
    }

    func billingRange(for event: WorkEvent, calendar: Calendar = .current) -> ClosedRange<Date>? {
        let cycle = event.company?.payCycle ?? .fifteenthAndMonthEnd
        let payday = PayCycle.payday(for: event, calendar: calendar)
        let range = closedRange
        func overlaps(_ window: ClosedRange<Date>) -> Bool {
            let start = calendar.startOfDay(for: event.startDate)
            let end = calendar.startOfDay(for: event.endDate)
            return start <= window.upperBound && end >= window.lowerBound
        }

        switch paydayMode {
        case .firstHalf:
            if cycle == .monthEnd || payday != 15 { return nil }
            return overlaps(range) ? range : nil
        case .secondHalf:
            if payday != 30 { return nil }
            if cycle == .monthEnd {
                let monthStart = calendar.startOfMonth(for: monthAnchor)
                let monthEnd = calendar.startOfDay(for: calendar.endOfMonth(for: monthAnchor))
                let monthRange = monthStart ... monthEnd
                return overlaps(monthRange) ? monthRange : nil
            }
            return overlaps(range) ? range : nil
        default:
            return overlaps(range) ? range : nil
        }
    }
}
