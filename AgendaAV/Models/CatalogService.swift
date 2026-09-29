import Foundation
import SwiftData

@Model
final class CatalogService {
    var uuid: UUID
    var name: String
    var createdAt: Date

    init(uuid: UUID = UUID(), name: String, createdAt: Date = .now) {
        self.uuid = uuid
        self.name = name
        self.createdAt = createdAt
    }
}
