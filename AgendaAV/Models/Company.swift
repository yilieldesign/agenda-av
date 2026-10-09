import Foundation
import SwiftData

enum PayCycle: String, CaseIterable, Identifiable {
    case fifteenthAndMonthEnd = "15-30"
    case monthEnd = "30"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fifteenthAndMonthEnd: "El 15 y el 30"
        case .monthEnd: "Solo el 30"
        }
    }

    static func payday(for event: WorkEvent, calendar: Calendar = .current) -> Int {
        if event.company?.payCycle == .monthEnd { return 30 }
        return calendar.component(.day, from: event.startDate) <= 15 ? 15 : 30
    }
}

@Model
final class Company {
    /// Identificador de negocio (aparte del `persistentModelID` de SwiftData).
    var uuid: UUID
    var name: String
    var colorHex: String
    var createdAt: Date
    var payCycleRaw: String = "15-30"

    @Relationship(deleteRule: .nullify, inverse: \WorkEvent.company)
    var events: [WorkEvent]

    var payCycle: PayCycle {
        get { PayCycle(rawValue: payCycleRaw) ?? .fifteenthAndMonthEnd }
        set { payCycleRaw = newValue.rawValue }
    }

    init(
        uuid: UUID = UUID(),
        name: String,
        colorHex: String,
        createdAt: Date = .now,
        payCycle: PayCycle = .fifteenthAndMonthEnd
    ) {
        self.uuid = uuid
        self.name = name
        self.colorHex = colorHex
        self.createdAt = createdAt
        self.payCycleRaw = payCycle.rawValue
        self.events = []
    }
}
