import Foundation
import SwiftData

@Model
final class FixedExpense {
    var uuid: UUID
    var name: String
    var amount: Decimal
    var dueDay: Int
    var notes: String
    var paidMonthsRaw: String

    init(
        uuid: UUID = UUID(),
        name: String,
        amount: Decimal,
        dueDay: Int,
        notes: String = "",
        paidMonthsRaw: String = "[]"
    ) {
        self.uuid = uuid
        self.name = name
        self.amount = amount
        self.dueDay = min(31, max(1, dueDay))
        self.notes = notes
        self.paidMonthsRaw = paidMonthsRaw
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
