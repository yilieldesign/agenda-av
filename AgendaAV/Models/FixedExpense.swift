import Foundation
import SwiftData

@Model
final class FixedExpense {
    var uuid: UUID
    var entity: String = ""
    var name: String
    var amount: Decimal
    var dueDay: Int
    var notes: String
    var paidMonthsRaw: String

    init(
        uuid: UUID = UUID(),
        entity: String = "",
        name: String,
        amount: Decimal,
        dueDay: Int,
        notes: String = "",
        paidMonthsRaw: String = "[]"
    ) {
        self.uuid = uuid
        self.entity = entity.trimmingCharacters(in: .whitespacesAndNewlines)
        self.name = name
        self.amount = amount
        self.dueDay = min(31, max(1, dueDay))
        self.notes = notes
        self.paidMonthsRaw = paidMonthsRaw
    }

    static func splitName(_ name: String) -> (entity: String, label: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let dash = trimmed.firstIndex(where: { "-–—".contains($0) }) else {
            return (trimmed, trimmed)
        }
        let entity = String(trimmed[..<dash]).trimmingCharacters(in: .whitespacesAndNewlines)
        let label = String(trimmed[trimmed.index(after: dash)...]).trimmingCharacters(in: .whitespacesAndNewlines)
        if !entity.isEmpty, !label.isEmpty {
            return (entity, label)
        }
        return (trimmed, trimmed)
    }

    var groupingEntity: String {
        let stored = entity.trimmingCharacters(in: .whitespacesAndNewlines)
        if !stored.isEmpty { return stored }
        return Self.splitName(name).entity
    }

    var groupingLabel: String {
        let stored = entity.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !stored.isEmpty {
            return trimmedName.isEmpty ? stored : trimmedName
        }
        return Self.splitName(name).label
    }

    var displayName: String {
        let entityName = groupingEntity
        let label = groupingLabel
        if !entityName.isEmpty, label != entityName {
            return "\(entityName) - \(label)"
        }
        return trimmedNameOrFallback
    }

    private var trimmedNameOrFallback: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? groupingEntity : trimmed
    }

    static func formValues(from expense: FixedExpense?) -> (entity: String, name: String) {
        guard let expense else { return ("", "") }
        let stored = expense.entity.trimmingCharacters(in: .whitespacesAndNewlines)
        if !stored.isEmpty {
            return (stored, expense.name)
        }
        let parts = splitName(expense.name)
        if parts.label != parts.entity {
            return (parts.entity, parts.label)
        }
        return ("", expense.name)
    }

    var paidMonths: Set<String> {
        get {
            let data = Data(paidMonthsRaw.utf8)
            let list = (try? JSONDecoder().decode([String].self, from: data)) ?? []
            return Set(list)
        }
        set {
            let data = (try? JSONEncoder().encode(Array(newValue).sorted())) ?? Data("[]".utf8)
            paidMonthsRaw = String(data: data, encoding: .utf8) ?? "[]"
        }
    }

    static func monthKey(_ date: Date, calendar: Calendar = .current) -> String {
        let year = calendar.component(.year, from: date)
        let month = calendar.component(.month, from: date)
        return String(format: "%04d-%02d", year, month)
    }

    func isPaid(in month: Date, calendar: Calendar = .current) -> Bool {
        paidMonths.contains(Self.monthKey(month, calendar: calendar))
    }

    func setPaid(_ paid: Bool, in month: Date, calendar: Calendar = .current) {
        var months = paidMonths
        let key = Self.monthKey(month, calendar: calendar)
        if paid {
            months.insert(key)
        } else {
            months.remove(key)
        }
        paidMonths = months
    }
}
