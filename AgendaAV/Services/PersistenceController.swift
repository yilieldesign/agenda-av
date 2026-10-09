import Foundation
import SwiftData

enum PersistenceController {
    static func makeContainer(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([Company.self, WorkEvent.self, CatalogService.self, FixedExpense.self])
        let configuration = ModelConfiguration(
            "AgendaAV",
            schema: schema,
            isStoredInMemoryOnly: inMemory
        )
        return try ModelContainer(for: schema, configurations: [configuration])
    }
}
