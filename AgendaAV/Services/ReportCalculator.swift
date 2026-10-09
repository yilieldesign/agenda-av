import Foundation

struct CompanyBreakdown: Identifiable, Hashable {
    var id: String { companyID }
    let companyID: String
    let name: String
    let colorHex: String
    let days: Int
    let jobCount: Int
    let amount: Decimal
}

struct PaymentBreakdown: Hashable {
    let paidCount: Int
    let pendingCount: Int
    let paidAmount: Decimal
    let pendingAmount: Decimal
}

struct MonthEarnings: Identifiable, Hashable {
    var id: Int { month }
    let month: Int
    let start: Date
    let label: String
    let total: Decimal
    let jobCount: Int
    let paid: Decimal
    let pending: Decimal
}

struct ReportSummary {
    let period: ReportPeriod
    let events: [WorkEvent]
    let jobCount: Int
    let totalAmount: Decimal
    let byCompany: [CompanyBreakdown]
    let payment: PaymentBreakdown
    let monthlyRows: [MonthEarnings]

    var periodTitle: String { period.title }
}

enum ReportCalculator {
    static func summarize(events: [WorkEvent], period: ReportPeriod, calendar: Calendar = .current) -> ReportSummary {
        let included = events
            .compactMap { event -> (WorkEvent, ClosedRange<Date>)? in
                guard let window = period.billingRange(for: event, calendar: calendar) else { return nil }
                return (event, window)
            }
            .sorted { $0.0.startDate < $1.0.startDate }
        let overlapping = included.map(\.0)

        var companyBuckets: [String: (name: String, hex: String, days: Set<Date>, jobs: Int, amount: Decimal)] = [:]

        for (event, window) in included {
            let key = event.company?.uuid.uuidString ?? "sin-empresa"
            let name = event.company?.name ?? "Sin empresa"
            let hex = event.company?.colorHex ?? "#6B7280"
            let days = overlappingDays(of: event, range: window, calendar: calendar)
            var bucket = companyBuckets[key] ?? (name, hex, [], 0, 0)
            bucket.days.formUnion(days)
            bucket.jobs += 1
            bucket.amount += event.billedAmount(in: window, calendar: calendar)
            companyBuckets[key] = bucket
        }

        let byCompany = companyBuckets
            .map { key, value in
                CompanyBreakdown(
                    companyID: key,
                    name: value.name,
                    colorHex: value.hex,
                    days: value.days.count,
                    jobCount: value.jobs,
                    amount: value.amount
                )
            }
            .sorted { $0.amount > $1.amount }

        let paidEvents = overlapping.filter { $0.paymentStatus == .paid }
        let pendingEvents = overlapping.filter { $0.paymentStatus == .pending }

        let monthlyRows: [MonthEarnings]
        if period.kind == .yearly {
            monthlyRows = monthlyEarnings(
                events: events,
                year: calendar.component(.year, from: period.monthAnchor),
                calendar: calendar
            )
        } else {
            monthlyRows = []
        }

        return ReportSummary(
            period: period,
            events: overlapping,
            jobCount: overlapping.count,
            totalAmount: included.reduce(0) { $0 + $1.0.billedAmount(in: $1.1, calendar: calendar) },
            byCompany: byCompany,
            payment: PaymentBreakdown(
                paidCount: paidEvents.count,
                pendingCount: pendingEvents.count,
                paidAmount: paidEvents.reduce(0) { sum, event in
                    sum + (period.billingRange(for: event, calendar: calendar).map { event.billedAmount(in: $0, calendar: calendar) } ?? 0)
                },
                pendingAmount: pendingEvents.reduce(0) { sum, event in
                    sum + (period.billingRange(for: event, calendar: calendar).map { event.billedAmount(in: $0, calendar: calendar) } ?? 0)
                }
            ),
            monthlyRows: monthlyRows
        )
    }

    static func monthlyEarnings(
        events: [WorkEvent],
        year: Int,
        calendar: Calendar = .current
    ) -> [MonthEarnings] {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_DO")
        formatter.setLocalizedDateFormatFromTemplate("MMMM")

        return (1...12).compactMap { month in
            var components = DateComponents()
            components.year = year
            components.month = month
            components.day = 1
            guard let start = calendar.date(from: components) else { return nil }
            let monthStart = calendar.startOfDay(for: start)
            let monthEnd = calendar.startOfDay(for: calendar.endOfMonth(for: start))
            let started = events.filter {
                let jobStart = calendar.startOfDay(for: $0.startDate)
                return jobStart >= monthStart && jobStart <= monthEnd
            }
            let paid = started.filter { $0.paymentStatus == .paid }
            let pending = started.filter { $0.paymentStatus == .pending }
            return MonthEarnings(
                month: month,
                start: start,
                label: formatter.string(from: start).capitalized,
                total: started.reduce(0) { $0 + $1.billedAmount },
                jobCount: started.count,
                paid: paid.reduce(0) { $0 + $1.billedAmount },
                pending: pending.reduce(0) { $0 + $1.billedAmount }
            )
        }
    }

    private static func overlappingDays(
        of event: WorkEvent,
        range: ClosedRange<Date>,
        calendar: Calendar
    ) -> Set<Date> {
        let start = max(calendar.startOfDay(for: event.startDate), range.lowerBound)
        let end = min(calendar.startOfDay(for: event.endDate), range.upperBound)
        guard start <= end else { return [] }
        return Set(calendar.days(from: start, to: end))
    }
}
