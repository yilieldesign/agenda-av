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
    /// Nombre opcional de la actividad (concierto, boda, etc.). Vacío = se muestran los servicios.
    var activityName: String = ""
    /// JSON con los nombres de servicio. Un trabajo puede tener varios con un solo monto.
    var servicesRaw: String
    /// Monto en la moneda local del dispositivo, almacenado como Decimal.
    var amount: Decimal
    var paymentStatusRaw: String
    var notes: String
    var createdAt: Date
    var company: Company?
    /// JSON de recordatorios (`EventReminder`). Vacío = sin avisos.
    var remindersRaw: String = "[]"

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

    /// Cobro completo si el trabajo cae en el período; no se parte por días del mes.
    func billedAmount(in range: ClosedRange<Date>, calendar: Calendar = .current) -> Decimal {
        overlappingDayCount(in: range, calendar: calendar) > 0 ? billedAmount : 0
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

    var displayTitle: String {
        let activity = activityName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !activity.isEmpty { return activity }
        return projectName.isEmpty ? "Trabajo" : projectName
    }

    var reportLabel: String {
        let activity = activityName.trimmingCharacters(in: .whitespacesAndNewlines)
        let services = listedServices.joined(separator: ", ")
        if !activity.isEmpty && !services.isEmpty { return "\(activity) - \(services)" }
        if !activity.isEmpty { return activity }
        return services.isEmpty ? "Trabajo" : services
    }

    var hasExplicitSchedule: Bool {
        let calendar = Calendar.current
        let startMidnight = calendar.component(.hour, from: startDate) == 0 && calendar.component(.minute, from: startDate) == 0
        let endMidnight = calendar.component(.hour, from: endDate) == 0 && calendar.component(.minute, from: endDate) == 0
        return !(startMidnight && endMidnight)
    }

    var scheduleLabel: String {
        guard hasExplicitSchedule else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_DO")
        formatter.dateFormat = "HH:mm"
        return "desde \(formatter.string(from: startDate)) - hasta \(formatter.string(from: endDate))"
    }

    var reminders: [EventReminder] {
        get {
            guard let data = remindersRaw.data(using: .utf8),
                  let decoded = try? EventReminder.decoder.decode([EventReminder].self, from: data) else {
                return []
            }
            return decoded
        }
        set {
            if let data = try? EventReminder.encoder.encode(newValue),
               let raw = String(data: data, encoding: .utf8) {
                remindersRaw = raw
            } else {
                remindersRaw = "[]"
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
        activityName: String = "",
        company: Company? = nil,
        createdAt: Date = .now,
        serviceNames: [String] = [],
        reminders: [EventReminder] = []
    ) {
        self.uuid = uuid
        self.startDate = startDate
        self.endDate = max(startDate, endDate)
        self.amount = amount
        self.paymentStatusRaw = paymentStatus.rawValue
        self.notes = notes
        self.activityName = activityName.trimmingCharacters(in: .whitespacesAndNewlines)
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
        if let data = try? EventReminder.encoder.encode(reminders),
           let raw = String(data: data, encoding: .utf8) {
            self.remindersRaw = raw
        } else {
            self.remindersRaw = "[]"
        }
    }

    func occupies(_ day: Date, calendar: Calendar = .current) -> Bool {
        let dayStart = calendar.startOfDay(for: day)
        let rangeStart = calendar.startOfDay(for: startDate)
        let rangeEnd = calendar.startOfDay(for: endDate)
        return dayStart >= rangeStart && dayStart <= rangeEnd
    }
}
