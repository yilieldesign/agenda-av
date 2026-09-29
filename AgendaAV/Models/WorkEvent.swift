import Foundation
import SwiftData

/// Trabajo / evento audiovisual agendado. El nombre `WorkEvent` evita colisiones
/// con tipos de EventKit y deja claro que es un servicio cobrable.
@Model
final class WorkEvent {
    var uuid: UUID
    var startDate: Date
    var endDate: Date
    var projectName: String
    /// JSON con los nombres de servicio. Un trabajo puede tener varios con un solo monto.
    var servicesRaw: String
    /// Monto en la moneda local del dispositivo, almacenado como Decimal.
    var amount: Decimal
    var paymentStatusRaw: String
    var notes: String
    var createdAt: Date
    var company: Company?

    var paymentStatus: PaymentStatus {
        get { PaymentStatus(rawValue: paymentStatusRaw) ?? .pending }
        set { paymentStatusRaw = newValue.rawValue }
    }

    var isMultiDay: Bool {
        !Calendar.current.isDate(startDate, inSameDayAs: endDate)
    }

    var occupiedDayCount: Int {
        Calendar.current.inclusiveDayCount(from: startDate, to: endDate)
    }

    /// El `amount` es el cobro de un día; el total es ese monto por cada día del rango.
    var billedAmount: Decimal {
        amount * Decimal(occupiedDayCount)
    }

    func overlappingDayCount(in range: ClosedRange<Date>, calendar: Calendar = .current) -> Int {
        let start = max(calendar.startOfDay(for: startDate), calendar.startOfDay(for: range.lowerBound))
        let end = min(calendar.startOfDay(for: endDate), calendar.startOfDay(for: range.upperBound))
        guard start <= end else { return 0 }
        return calendar.inclusiveDayCount(from: start, to: end)
    }

    func billedAmount(in range: ClosedRange<Date>, calendar: Calendar = .current) -> Decimal {
        amount * Decimal(overlappingDayCount(in: range, calendar: calendar))
    }

    var listedServices: [String] {
        get {
            if let data = servicesRaw.data(using: .utf8),
               let names = try? JSONDecoder().decode([String].self, from: data),
               !names.isEmpty {
                return names
            }
            return projectName
                .split(separator: ",")
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        set {
            let names = newValue
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            projectName = names.joined(separator: ", ")
            if let data = try? JSONEncoder().encode(names),
               let raw = String(data: data, encoding: .utf8) {
                servicesRaw = raw
            } else {
                servicesRaw = "[]"
            }
        }
    }

    init(
        uuid: UUID = UUID(),
        startDate: Date,
        endDate: Date,
        projectName: String,
        amount: Decimal,
        paymentStatus: PaymentStatus = .pending,
        notes: String = "",
        company: Company? = nil,
        createdAt: Date = .now,
        serviceNames: [String] = []
    ) {
        self.uuid = uuid
        self.startDate = startDate
        self.endDate = max(startDate, endDate)
        self.amount = amount
        self.paymentStatusRaw = paymentStatus.rawValue
        self.notes = notes
        self.createdAt = createdAt
        self.company = company
        let names = serviceNames.isEmpty
            ? [projectName].map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            : serviceNames
        self.projectName = names.joined(separator: ", ")
        if let data = try? JSONEncoder().encode(names),
           let raw = String(data: data, encoding: .utf8) {
            self.servicesRaw = raw
        } else {
            self.servicesRaw = "[]"
        }
    }

    func occupies(_ day: Date, calendar: Calendar = .current) -> Bool {
        let dayStart = calendar.startOfDay(for: day)
        let rangeStart = calendar.startOfDay(for: startDate)
        let rangeEnd = calendar.startOfDay(for: endDate)
        return dayStart >= rangeStart && dayStart <= rangeEnd
    }
}
