import Foundation

extension Calendar {
    func startOfMonth(for date: Date) -> Date {
        let components = dateComponents([.year, .month], from: date)
        return self.date(from: components) ?? startOfDay(for: date)
    }

    func endOfMonth(for date: Date) -> Date {
        guard let nextMonth = date(byAdding: .month, value: 1, to: startOfMonth(for: date)),
              let lastDay = date(byAdding: .day, value: -1, to: nextMonth) else {
            return date
        }
        return lastDay
    }

    func inclusiveDayCount(from start: Date, to end: Date) -> Int {
        let s = startOfDay(for: start)
        let e = startOfDay(for: end)
        let days = dateComponents([.day], from: min(s, e), to: max(s, e)).day ?? 0
        return days + 1
    }

    func days(from start: Date, to end: Date) -> [Date] {
        let s = startOfDay(for: min(start, end))
        let e = startOfDay(for: max(start, end))
        var result: [Date] = []
        var cursor = s
        while cursor <= e {
            result.append(cursor)
            guard let next = date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return result
    }

    /// Celdas de un mes (nil = padding fuera del mes), alineadas a `firstWeekday`.
    func monthGrid(for month: Date) -> [Date?] {
        let monthStart = startOfMonth(for: month)
        let daysInMonth = range(of: .day, in: .month, for: monthStart)?.count ?? 30
        let weekdayOfFirst = component(.weekday, from: monthStart)
        let leading = (weekdayOfFirst - firstWeekday + 7) % 7

        var cells: [Date?] = Array(repeating: nil, count: leading)
        for day in 0..<daysInMonth {
            cells.append(date(byAdding: .day, value: day, to: monthStart))
        }
        let remainder = cells.count % 7
        if remainder != 0 {
            cells.append(contentsOf: Array(repeating: nil, count: 7 - remainder))
        }
        return cells
    }

    func orderedWeekdaySymbols(style: WeekdaySymbolStyle = .veryShort) -> [String] {
        var labeled = self
        labeled.locale = Locale(identifier: "es_DO")
        let symbols: [String]
        switch style {
        case .veryShort: symbols = labeled.veryShortWeekdaySymbols
        case .short: symbols = labeled.shortWeekdaySymbols
        }
        let startIndex = firstWeekday - 1
        return Array(symbols[startIndex...]) + Array(symbols[..<startIndex])
    }

    enum WeekdaySymbolStyle {
        case veryShort
        case short
    }
}

extension Date {
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }
}
