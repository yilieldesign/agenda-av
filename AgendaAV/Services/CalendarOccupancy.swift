import Foundation
import SwiftUI

struct DayOccupancy: Identifiable, Hashable {
    var id: Date { day }
    let day: Date
    let companyColorHexes: [String]
    let eventCount: Int

    var companyColors: [Color] {
        companyColorHexes.map { Color(hex: $0) }
    }

    var isAvailable: Bool { eventCount == 0 }
    var hasMultipleCompanies: Bool { companyColorHexes.count > 1 }
}

enum CalendarOccupancy {
    static func index(events: [WorkEvent], in month: Date, calendar: Calendar = .current) -> [Date: DayOccupancy] {
        let monthStart = calendar.startOfMonth(for: month)
        let monthEnd = calendar.startOfDay(for: calendar.endOfMonth(for: month))
        var hexesByDay: [Date: [String: String]] = [:]
        var countByDay: [Date: Int] = [:]

        for event in events {
            let overlapStart = max(calendar.startOfDay(for: event.startDate), monthStart)
            let overlapEnd = min(calendar.startOfDay(for: event.endDate), monthEnd)
            guard overlapStart <= overlapEnd else { continue }

            for day in calendar.days(from: overlapStart, to: overlapEnd) {
                countByDay[day, default: 0] += 1
                if let company = event.company {
                    hexesByDay[day, default: [:]][company.uuid.uuidString] = company.colorHex
                } else {
                    hexesByDay[day, default: [:]]["unassigned"] = "#6B7280"
                }
            }
        }

        var result: [Date: DayOccupancy] = [:]
        for day in calendar.days(from: monthStart, to: monthEnd) {
            result[day] = DayOccupancy(
                day: day,
                companyColorHexes: Array(hexesByDay[day]?.values ?? []),
                eventCount: countByDay[day] ?? 0
            )
        }
        return result
    }

    static func events(on day: Date, from events: [WorkEvent], calendar: Calendar = .current) -> [WorkEvent] {
        events
            .filter { $0.occupies(day, calendar: calendar) }
            .sorted { $0.startDate < $1.startDate }
    }
}
