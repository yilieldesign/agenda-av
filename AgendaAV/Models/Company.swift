import Foundation
import SwiftData

@Model
final class Company {
    /// Identificador de negocio (aparte del `persistentModelID` de SwiftData).
    var uuid: UUID
    var name: String
    var colorHex: String
    var createdAt: Date

    @Relationship(deleteRule: .nullify, inverse: \WorkEvent.company)
    var events: [WorkEvent]

    init(
        uuid: UUID = UUID(),
        name: String,
        colorHex: String,
        createdAt: Date = .now
    ) {
        self.uuid = uuid
        self.name = name
        self.colorHex = colorHex
        self.createdAt = createdAt
        self.events = []
    }
}
